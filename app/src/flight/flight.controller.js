import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import { buildLowFareSearchXML } from "./lowFareXml.js";
import { callTravelport } from "./travelport.service.js";
import {
  extractAirSegments,
  extractSegmentRefs,
  minutesBetween,
} from "../utils/helper.js";

/* =========================
   SEARCH FLIGHTS
   ========================= */
export const searchFlights = async (req, res) => {
  try {
    const { from, to, date, adults = 1 } = req.body;

    if (!from || !to || !date) {
      return res.status(400).json({ error: "from, to, date required" });
    }

    const xmlRequest = buildLowFareSearchXML({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      date,
      adults,
      targetBranch: process.env.TRAVELPORT_TARGET_BRANCH,
    });

    const xmlResponse = await callTravelport(xmlRequest);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });
    const json = parser.parse(xmlResponse);

    const rsp =
      json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];
    if (!rsp) return res.json({ success: true, flights: [] });

    const segmentMap = extractAirSegments(rsp);
    if (!Object.keys(segmentMap).length) {
      console.log("❌ No AirSegments found in response");
      return res.json({ success: true, flights: [] });
    }

    const rawSolutions = rsp["air:AirPricingSolution"];
    if (!rawSolutions) return res.json({ success: true, flights: [] });

    const solutions = Array.isArray(rawSolutions)
      ? rawSolutions
      : [rawSolutions];
    const uniqueFlights = new Map();

    for (const sol of solutions) {
      const price = Number(sol.TotalPrice?.replace(/[^\d]/g, ""));
      const currency = sol.TotalPrice?.replace(/[0-9.]/g, "");

      const refs = extractSegmentRefs(sol);
      if (!refs.length) continue;

      const segments = refs.map((r) => segmentMap[r.Key]).filter(Boolean);
      if (!segments.length) continue;

      const uniqueKey = segments
        .map((s) => `${s.carrier}${s.flightNumber}${s.departure}`)
        .join("-");

      const durationMinutes = minutesBetween(
        segments[0].departure,
        segments[segments.length - 1].arrival
      );
      const stops = segments.length - 1;

      const flight = {
        id: Buffer.from(uniqueKey).toString("base64"),
        price,
        currency,
        stops,
        durationMinutes,
        segments,
        pricingSolutionKey: sol.Key,
        segmentKeys: refs.map((r) => r.Key), // <-- include segment keys for flightDetails
      };

      if (
        !uniqueFlights.has(uniqueKey) ||
        price < uniqueFlights.get(uniqueKey).price
      ) {
        uniqueFlights.set(uniqueKey, flight);
      }
    }

    return res.json({
      success: true,
      flights: Array.from(uniqueFlights.values()).sort(
        (a, b) => a.price - b.price
      ),
    });
  } catch (err) {
    console.error("❌ Flight Search Error:", err);
    return res.status(500).json({ error: "Flight search failed" });
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
