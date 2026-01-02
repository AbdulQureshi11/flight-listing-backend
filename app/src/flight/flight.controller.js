import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import { buildLowFareSearchXML } from "./lowFareXml.js";
import { callTravelport } from "./travelport.service.js";
import {
  extractAirSegments,
  extractSegmentRefs,
  minutesBetween,
  parsePrice,
} from "../utils/helper.js";

/* =========================
   SEARCH FLIGHTS
   ========================= */
export const searchFlights = async (req, res) => {
  try {
    const {
      tripType,      // "oneway" | "round"
      from,
      to,
      date,
      returnDate,
      adults = 1
    } = req.body;

    console.log("🔍 Incoming search request:", req.body);

    /* ======================================================
     VALIDATION (REAL WORLD STYLE)
    ====================================================== */

    if (!tripType || !["oneway", "round"].includes(tripType)) {
      return res.status(400).json({
        error: "tripType must be 'oneway' or 'round'"
      });
    }

    if (!from || !to || !date) {
      return res.status(400).json({
        error: "from, to, and date are required"
      });
    }

    if (tripType === "oneway" && returnDate) {
      return res.status(400).json({
        error: "returnDate is not allowed for one-way trips"
      });
    }

    if (tripType === "round" && !returnDate) {
      return res.status(400).json({
        error: "returnDate is required for round trips"
      });
    }

    /* ======================================================
     SHARED ONE-WAY SEARCH FUNCTION (UNCHANGED LOGIC)
    ====================================================== */

    const runSingleSearch = async (origin, destination, depDate) => {
      const xmlRequest = buildLowFareSearchXML({
        from: origin,
        to: destination,
        departureDate: depDate,
        adults,
        targetBranch: process.env.TRAVELPORT_TARGET_BRANCH,
      });

      const xmlResponse = await callTravelport(xmlRequest);
      if (!xmlResponse) return [];

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
      });

      const json = parser.parse(xmlResponse);
      const rsp =
        json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];

      if (!rsp) return [];

      let flightsArray = [];

      const pricePoints = rsp["air:AirPricePointList"]?.["air:AirPricePoint"];
      if (!pricePoints) return [];

      const pricePointsArray = Array.isArray(pricePoints)
        ? pricePoints
        : [pricePoints];

      const segmentMap = extractAirSegments(rsp);

      for (const pricePoint of pricePointsArray) {
        const pricingInfo = pricePoint["air:AirPricingInfo"];
        if (!pricingInfo) continue;

        const totalPrice =
          pricingInfo.ApproximateTotalPrice ||
          pricePoint.ApproximateTotalPrice;

        const { amount: price, currency } = parsePrice(totalPrice);

        const refs = extractSegmentRefs(pricePoint);
        if (!refs.length) continue;

        const segments = refs
          .map((r) => segmentMap[r.Key])
          .filter(Boolean);

        if (!segments.length) continue;

        const durationMinutes = minutesBetween(
          segments[0].departure,
          segments[segments.length - 1].arrival
        );

        const uniqueKey = segments
          .map((s) => `${s.carrier}${s.flightNumber}${s.from}${s.to}`)
          .join("-");

        flightsArray.push({
          id: Buffer.from(uniqueKey + Date.now()).toString("base64"),
          price,
          currency,
          stops: segments.length - 1,
          durationMinutes,
          segments,
          cabinClass: segments[0]?.cabinClass || "Economy",
          refundable: pricingInfo.Refundable === "true",
          fareCalc: pricingInfo["air:FareCalc"] || "",
          pricingKey: pricePoint.Key,
          segmentKeys: refs.map((r) => r.Key),
        });
      }

      return flightsArray;
    };

    /* ======================================================
     EXECUTION
    ====================================================== */

    // ONE-WAY
    if (tripType === "oneway") {
      const flights = await runSingleSearch(
        from.toUpperCase(),
        to.toUpperCase(),
        date
      );

      return res.json({
        success: true,
        tripType: "oneway",
        flights,
        totalResults: flights.length,
      });
    }

    // ROUND-TRIP
    console.log("Round-trip search initiated...");

    const [outboundFlights, returnFlights] = await Promise.all([
      runSingleSearch(from.toUpperCase(), to.toUpperCase(), date),
      runSingleSearch(to.toUpperCase(), from.toUpperCase(), returnDate),
    ]);

    return res.json({
      success: true,
      tripType: "round",
      outboundFlights,
      returnFlights,
      outboundCount: outboundFlights.length,
      returnCount: returnFlights.length,
    });

  } catch (err) {
    console.error("Flight Search Error:", err);
    return res.status(500).json({
      error: "Flight search failed",
      message: err.message,
    });
  }
};


/* =========================
   FLIGHT DETAILS
   ========================= */
export const flightDetails = async (req, res) => {
  const { segments } = req.body;

  if (!segments || !segments.length) {
    return res.status(400).json({ error: "segments required" });
  }

  const invalidSegments = segments.filter((s) => !s.Key);
  if (invalidSegments.length > 0) {
    console.error("❌ Segments missing Key property:", invalidSegments);
    return res.status(400).json({
      error: "All segments must have a Key property",
    });
  }

  try {
    const segmentsXML = segments
      .map((seg) => {
        const travelTime = minutesBetween(seg.departure, seg.arrival);

        return `
        <air:AirSegment
          Key="${seg.Key}"
          Group="0"
          Carrier="${seg.carrier}"
          FlightNumber="${seg.flightNumber}"
          Origin="${seg.from}"
          Destination="${seg.to}"
          DepartureTime="${seg.departure}"
          ArrivalTime="${seg.arrival}"
          TravelTime="${travelTime}"
          Distance="${seg.distance || 0}"
          ETicketability="Yes"
          Equipment="${seg.equipment || "320"}"
          ChangeOfPlane="false"
          ParticipantLevel="Secure Sell"
          LinkAvailability="true"
          OptionalServicesIndicator="false"
          AvailabilitySource="P"
          ProviderCode="${seg.providerCode || "1G"}"
        />`;
      })
      .join("");

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:air="http://www.travelport.com/schema/air_v54_0"
                  xmlns:com="http://www.travelport.com/schema/common_v54_0">
  <soapenv:Header/>
  <soapenv:Body>
    <air:AirPriceReq
        AuthorizedBy="user"
        TargetBranch="${process.env.TRAVELPORT_TARGET_BRANCH}"
        TraceId="NODE-${Date.now()}">

      <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>

      <air:AirItinerary>
        ${segmentsXML}
      </air:AirItinerary>
      <air:AirPricingModifiers FaresIndicator="AllFares">
        <air:BrandModifiers ModifierType="FareFamilyDisplay"/>
      </air:AirPricingModifiers>
      <com:SearchPassenger Key="ADT1" Code="ADT"/>

      <air:AirPricingCommand/>

    </air:AirPriceReq>
  </soapenv:Body>
</soapenv:Envelope>`;

    console.log("✅ AirPriceReq XML:\n", xmlRequest);
    const xmlResponse = await callTravelport(xmlRequest);
    //fs.writeFileSync("AirPriceRsp.xml", xmlResponse);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(xmlResponse);

    const envelope = json["SOAP:Envelope"] || json["soapenv:Envelope"];
    const body = envelope?.["SOAP:Body"] || envelope?.["soapenv:Body"];

    const fault = body?.["SOAP:Fault"] || body?.["soapenv:Fault"];
    if (fault) {
      console.error("❌ Travelport Fault:", JSON.stringify(fault, null, 2));
      return res.status(500).json({ error: "Travelport fault", fault });
    }

    const priceRsp = body?.["air:AirPriceRsp"];
    if (!priceRsp) {
      console.error("❌ No AirPriceRsp");
      return res.status(500).json({ error: "No AirPriceRsp in response" });
    }

    const priceResult = priceRsp["air:AirPriceResult"];

    if (!priceResult) {
      console.error(
        "❌ No AirPriceResult. Available keys:",
        Object.keys(priceRsp)
      );
      return res.status(500).json({
        error: "No price result",
        availableKeys: Object.keys(priceRsp),
      });
    }

    let pricingSolution = priceResult["air:AirPricingSolution"];

    if (!pricingSolution) {
      console.error("❌ No AirPricingSolution in result");
      return res.status(500).json({ error: "No pricing solution" });
    }

    if (Array.isArray(pricingSolution)) {
      pricingSolution = pricingSolution[0];
    }

    let pricingInfo = pricingSolution["air:AirPricingInfo"];

    if (!pricingInfo) {
      console.error("❌ No AirPricingInfo in solution");
      return res.status(500).json({ error: "No pricing info" });
    }

    if (Array.isArray(pricingInfo)) {
      pricingInfo = pricingInfo[0];
    }

    const pricingKey = pricingInfo["@_Key"] || pricingInfo.Key;

    if (!pricingKey) {
      console.error("❌ No pricing key found");
      return res.status(500).json({ error: "No pricing key" });
    }

    // ✅ FIX: Extract segment keys from the ITINERARY in the response
    const itinerary = priceRsp["air:AirItinerary"];
    let responseSegments = itinerary?.["air:AirSegment"];

    if (!responseSegments) {
      console.error("❌ No segments in itinerary");
      return res.status(500).json({ error: "No segments in itinerary" });
    }

    // Handle single or multiple segments
    if (!Array.isArray(responseSegments)) {
      responseSegments = [responseSegments];
    }

    // ✅ Extract the segment keys from the RESPONSE, not the request
    const segmentKeys = responseSegments
      .map((seg) => seg["@_Key"] || seg.Key)
      .filter(Boolean);

    console.log("✅ Pricing successful:", {
      pricingKey,
      segmentKeys,
      totalPrice: pricingSolution["@_TotalPrice"],
    });

    res.json({
      success: true,
      pricing: pricingInfo,
      pricingSolution: pricingSolution,
      pricingKey,
      passengerKey: "ADT1",
      segmentKeys, // ✅ These are now from the pricing response
      itinerary,
    });
  } catch (err) {
    console.error("❌ Pricing Error:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({
      error: "Pricing failed",
      message: err.message,
    });
  }
};

// export const optionalServices = async (req, res) => {
//   const { pricingKey, passengerKey, segmentKeys } = req.body;

//   if (!pricingKey || !passengerKey || !segmentKeys?.length) {
//     return res.status(400).json({ error: "Missing required refs" });
//   }

//   const segmentRefsXML = segmentKeys
//     .map((k) => `<air:AirSegmentRef Key="${k}"/>`)
//     .join("");

//   const xmlRequest = `
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
//                   xmlns:air="http://www.travelport.com/schema/air_v54_0"
//                   xmlns:com="http://www.travelport.com/schema/common_v54_0">
//   <soapenv:Body>
//     <air:OptionalServicesReq
//         AuthorizedBy="user"
//         TargetBranch="${process.env.TRAVELPORT_TARGET_BRANCH}"
//         TraceId="NODE-ANC-${Date.now()}">

//       <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>

//       <air:AirPricingInfoRef Key="${pricingKey}"/>

//       <air:SearchPassengerRef Key="${passengerKey}"/>

//       ${segmentRefsXML}

//     </air:OptionalServicesReq>
//   </soapenv:Body>
// </soapenv:Envelope>`;

//   const xmlResponse = await callTravelport(xmlRequest);

//   const parser = new XMLParser({ ignoreAttributes: false });
//   const json = parser.parse(xmlResponse);

//   const fault = json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["SOAP:Fault"];
//   if (fault) return res.status(500).json(fault);

//   res.json({
//     success: true,
//     optionalServices:
//       json["SOAP:Envelope"]["SOAP:Body"]["air:OptionalServicesRsp"],
//   });
// };
// export const optionalServices = async (req, res) => {
//   console.log("📦 Ancillaries Request:", req.body);

//   const { pricingKey, passengerKey, segmentKeys } = req.body;

//   if (!pricingKey || !passengerKey || !segmentKeys?.length) {
//     console.error("❌ Missing required fields");
//     return res.status(400).json({ error: "Missing required refs" });
//   }

//   try {
//     const segmentRefsXML = segmentKeys
//       .map((k) => `<air:AirSegmentRef Key="${k}"/>`)
//       .join("");

//     const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
//                   xmlns:air="http://www.travelport.com/schema/air_v54_0"
//                   xmlns:com="http://www.travelport.com/schema/common_v54_0">
//   <soapenv:Body>
//     <air:OptionalServicesReq
//         AuthorizedBy="user"
//         TargetBranch="${process.env.TRAVELPORT_TARGET_BRANCH}"
//         TraceId="NODE-ANC-${Date.now()}">

//       <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
//       <air:AirPricingInfoRef Key="${pricingKey}"/>
//       <air:SearchPassengerRef Key="${passengerKey}"/>
//       ${segmentRefsXML}

//     </air:OptionalServicesReq>
//   </soapenv:Body>
// </soapenv:Envelope>`;

//     console.log("✅ Sending OptionalServicesReq...");

//     const xmlResponse = await callTravelport(xmlRequest);

//     const parser = new XMLParser({
//       ignoreAttributes: false,
//       attributeNamePrefix: "@_",
//     });
//     const json = parser.parse(xmlResponse);

//     const envelope = json["SOAP:Envelope"] || json["soapenv:Envelope"];
//     const body = envelope?.["SOAP:Body"] || envelope?.["soapenv:Body"];

//     const fault = body?.["SOAP:Fault"] || body?.["soapenv:Fault"];
//     if (fault) {
//       console.error("❌ Travelport Fault:", JSON.stringify(fault, null, 2));

//       // Return gracefully instead of 500
//       return res.json({
//         success: true,
//         optionalServices: null,
//         message: "Ancillary services not available for this flight",
//       });
//     }

//     const optServicesRsp = body?.["air:OptionalServicesRsp"];

//     res.json({
//       success: true,
//       optionalServices: optServicesRsp,
//     });
//   } catch (err) {
//     console.error("❌ Ancillaries Error:", err.message);
//     console.error("Stack:", err.stack);

//     // ✅ Return gracefully instead of crashing
//     return res.json({
//       success: true,
//       optionalServices: null,
//       message: "Ancillary services temporarily unavailable",
//     });
//   }
// };
export const validatePassengers = async (req, res) => {
  const { passengers } = req.body;

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({
      success: false,
      errors: ["Passengers array required"],
    });
  }

  const errors = [];

  const adults = passengers.filter((p) => p.type === "ADT").length;
  const infants = passengers.filter((p) => p.type === "INF").length;

  if (infants > adults) {
    errors.push(
      "Each infant must be associated with one adult (1 infant per adult allowed)"
    );
  }

  passengers.forEach((pax, idx) => {
    if (!pax.firstName)
      errors.push(`Passenger ${idx + 1}: first name required`);
    if (!pax.lastName) errors.push(`Passenger ${idx + 1}: last name required`);
    if (!["M", "F"].includes(pax.gender))
      errors.push(`Passenger ${idx + 1}: valid gender required`);
    if (!["ADT", "CNN", "INF"].includes(pax.type))
      errors.push(`Passenger ${idx + 1}: valid passenger type required`);
    if (!pax.dob) errors.push(`Passenger ${idx + 1}: date of birth required`);
    if (!pax.passportNumber)
      errors.push(`Passenger ${idx + 1}: passport number required`);
    if (!pax.passportExpiry)
      errors.push(`Passenger ${idx + 1}: passport expiry required`);
    if (!pax.nationality)
      errors.push(`Passenger ${idx + 1}: nationality required`);
  });

  if (errors.length) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  return res.json({
    success: true,
    message: "Passengers validated successfully",
    passengers,
  });
};

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regex)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

export const validateContactInfo = async (req, res) => {
  const { email, phone, phoneCountryCode } = req.body;

  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push("Valid email required");
  }

  if (!phone || phone.length < 7) {
    errors.push("Valid phone number required");
  }

  if (!phoneCountryCode) {
    errors.push("Phone country code required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  return res.json({
    success: true,
    message: "Contact info validated",
    contactInfo: { email, phone, phoneCountryCode },
  });
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// export const createReservation = async (req, res) => {
//   try {
//     const {
//       pricingSolution,
//       itinerary,
//       passengers,
//       contactInfo,
//       formOfPayment,
//     } = req.body;

//     if (!pricingSolution)
//       return res.status(400).json({ error: "Pricing solution required" });
//     if (!passengers || !passengers.length)
//       return res.status(400).json({ error: "Passengers required" });
//     if (!contactInfo?.email || !contactInfo?.phone)
//       return res.status(400).json({ error: "Contact info required" });

//     // ✅ BookingTraveler XML
//     const bookingTravelersXML = passengers
//       .map((pax, idx) => {
//         const key = `PAX${idx + 1}`;
//         return `<com:BookingTraveler Key="${key}" TravelerType="${
//           pax.type
//         }" Gender="${pax.gender}"${pax.dob ? ` DOB="${pax.dob}"` : ""}>
//   <com:BookingTravelerName${
//     pax.prefix ? ` Prefix="${pax.prefix}"` : ""
//   } First="${pax.firstName}" Last="${pax.lastName}"/>
//   <com:PhoneNumber Type="Mobile" CountryCode="${
//     pax.phoneCountryCode || contactInfo.phoneCountryCode
//   }" Number="${pax.phone || contactInfo.phone}"/>
//   <com:Email EmailID="${pax.email || contactInfo.email}"/>
// </com:BookingTraveler>`;
//       })
//       .join("\n");

//     // ✅ AirPricingSolution XML
//     const airPricingSolutionXML = buildAirPricingSolutionXML(
//       pricingSolution,
//       itinerary,
//       passengers
//     );

//     // ✅ Get total price - use TotalPrice from pricingSolution, not BasePrice
//     const totalPrice =
//       pricingSolution?.["@_TotalPrice"] || pricingSolution?.TotalPrice;

//     if (!totalPrice) {
//       return res
//         .status(400)
//         .json({ error: "Total price not found in pricing solution" });
//     }

//     // Extract numeric amount (remove currency code)
//     const paymentAmount = totalPrice.replace(/[A-Z]/g, "");
//     const paymentKey = `PAY${Date.now()}`;

//     // ✅ FormOfPayment XML
//     const formOfPaymentXML = formOfPayment?.cardNumber
//       ? `<com:FormOfPayment Key="${paymentKey}" Type="Credit">
//   <com:CreditCard Type="${formOfPayment.cardType}" Number="${formOfPayment.cardNumber}" ExpDate="${formOfPayment.expDate}" Name="${formOfPayment.cardHolderName}"/>
// </com:FormOfPayment>`
//       : `<com:FormOfPayment Key="${paymentKey}" Type="Cash"/>`;

//     // ✅ Ticketing date - 7 days from now
//     const ticketDate = new Date();
//     ticketDate.setDate(ticketDate.getDate() + 7);

//     // ✅ Final XML request
//     const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
//                   xmlns:univ="http://www.travelport.com/schema/universal_v54_0"
//                   xmlns:air="http://www.travelport.com/schema/air_v54_0"
//                   xmlns:com="http://www.travelport.com/schema/common_v54_0">
//   <soapenv:Header/>
//   <soapenv:Body>
//     <univ:AirCreateReservationReq TraceId="PNR-${Date.now()}" TargetBranch="${
//       process.env.TRAVELPORT_TARGET_BRANCH
//     }" AuthorizedBy="user" RetainReservation="Both">
//       <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
//       ${bookingTravelersXML}
//       ${formOfPaymentXML}
//       ${airPricingSolutionXML}
//       <com:ActionStatus Type="ACTIVE" ProviderCode="1G"/>

//     </univ:AirCreateReservationReq>
//   </soapenv:Body>
// </soapenv:Envelope>`;

//     console.log("🎫 AirCreateReservationReq XML:\n", xmlRequest);

//     const xmlResponse = await callTravelport(xmlRequest);
//     fs.writeFileSync("AirCreateReservationRsp.xml", xmlResponse);

//     const parser = new XMLParser({
//       ignoreAttributes: false,
//       attributeNamePrefix: "@_",
//     });
//     const json = parser.parse(xmlResponse);
//     const body =
//       json["SOAP:Envelope"]?.["SOAP:Body"] ||
//       json["soapenv:Envelope"]?.["soapenv:Body"];
//     const fault = body?.["SOAP:Fault"];
//     if (fault) return res.status(500).json({ fault });

//     const rsp = body["univ:AirCreateReservationRsp"];
//     const record = rsp?.["univ:UniversalRecord"];
//     const locator = record?.["@_LocatorCode"];
//     if (!locator) return res.status(500).json({ error: "PNR not returned" });

//     return res.json({ success: true, pnr: locator, record });
//   } catch (err) {
//     console.error("❌ PNR Creation Error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };

// function buildAirPricingSolutionXML(pricingSolution, itinerary, passengers) {
//   if (!pricingSolution) return "";

//   const solutionKey = pricingSolution["@_Key"] || pricingSolution.Key;
//   if (!solutionKey) {
//     console.warn("⚠️ No Key found in AirPricingSolution");
//     return "";
//   }

//   // ✅ Extract air segments from pricing solution
//   const airSegments = extractSegments(itinerary);

//   return `
// <air:AirPricingSolution Key="${solutionKey}" PricingMethod="Auto">
//   ${airSegments}
//   ${buildAirPricingInfoXML(pricingSolution, passengers)}
// </air:AirPricingSolution>`;
// }

// // ✅ New function to extract segments
// function extractSegments(itinerary) {
//   // Look for segments in the pricing solution
//   const segments = itinerary?.["air:AirSegment"];

//   if (!segments) {
//     console.warn("⚠️ No AirSegment found in pricing solution");
//     return "";
//   }

//   const segmentArray = Array.isArray(segments) ? segments : [segments];

//   return segmentArray
//     .map((seg) => {
//       return `<air:AirSegment
//       Key="${seg["@_Key"]}"
//       Group="${seg["@_Group"] || "0"}"
//       Carrier="${seg["@_Carrier"]}"
//       FlightNumber="${seg["@_FlightNumber"]}"
//       Origin="${seg["@_Origin"]}"
//       Destination="${seg["@_Destination"]}"
//       DepartureTime="${seg["@_DepartureTime"]}"
//       ArrivalTime="${seg["@_ArrivalTime"]}"
//       FlightTime="${seg["@_FlightTime"]}"
//       Distance="${seg["@_Distance"] || ""}"
//       ProviderCode="${seg["@_ProviderCode"] || "1G"}"
//       ClassOfService="${seg["@_ClassOfService"] || ""}"/>`;
//     })
//     .join("\n");
// }

// function buildAirPricingInfoXML(pricingSolution, passengers) {
//   const airPricingInfo = pricingSolution["air:AirPricingInfo"];
//   if (!airPricingInfo) return "";

//   const pricingInfos = Array.isArray(airPricingInfo)
//     ? airPricingInfo
//     : [airPricingInfo];

//   return pricingInfos
//     .map((info) => {
//       const passengerType = info["air:PassengerType"];
//       const paxCode = passengerType?.["@_Code"];

//       if (!paxCode) {
//         throw new Error("PassengerTypeCode missing from pricing response");
//       }

//       // ✅ Extract FareInfo
//       const fareInfos = info["air:FareInfo"];
//       const fareInfoArray = Array.isArray(fareInfos)
//         ? fareInfos
//         : fareInfos
//         ? [fareInfos]
//         : [];

//       // ✅ Build FareInfo XML
//       const fareInfoXML = fareInfoArray
//         .map((fi) => {
//           return `<air:FareInfo
//       Key="${fi["@_Key"]}"
//       FareBasis="${fi["@_FareBasis"]}"
//       PassengerTypeCode="${fi["@_PassengerTypeCode"]}"
//       Origin="${fi["@_Origin"]}"
//       Destination="${fi["@_Destination"]}"
//       EffectiveDate="${fi["@_EffectiveDate"]}"
//       DepartureDate="${fi["@_DepartureDate"] || fi["@_EffectiveDate"]}"
//       Amount="${fi["@_Amount"] || "0"}"/>`;
//         })
//         .join("\n    ");

//       // ✅ Extract BookingInfo
//       const bookingInfos = info["air:BookingInfo"];

//       if (!bookingInfos) {
//         console.error("❌ No BookingInfo found in AirPricingInfo");
//         throw new Error(
//           "BookingInfo is required but not found in pricing response"
//         );
//       }

//       const bookingInfoArray = Array.isArray(bookingInfos)
//         ? bookingInfos
//         : [bookingInfos];

//       // ✅ Build BookingInfo XML
//       const bookingInfoXML = bookingInfoArray
//         .map((bi) => {
//           return `<air:BookingInfo
//       BookingCode="${bi["@_BookingCode"]}"
//       CabinClass="${bi["@_CabinClass"] || ""}"
//       FareInfoRef="${bi["@_FareInfoRef"]}"
//       SegmentRef="${bi["@_SegmentRef"]}"/>`;
//         })
//         .join("\n    ");

//       return `
// <air:AirPricingInfo
//     Key="${info["@_Key"]}"
//     PricingMethod="Auto"
//     TotalPrice="${info["@_TotalPrice"]}"
//     Taxes="${info["@_Taxes"]}">

//     ${fareInfoXML}

//     ${bookingInfoXML}

//     <air:PassengerType
//         Code="${paxCode}"
//         BookingTravelerRef="PAX1"/>

// </air:AirPricingInfo>`;
//     })
//     .join("\n");
// }
