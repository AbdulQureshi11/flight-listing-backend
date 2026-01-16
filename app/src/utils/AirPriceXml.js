import axios from "axios";
import fs from "fs";
import { parseString } from "xml2js";

export const buildAirPriceXML = (selectedFlight, passengers) => {
  const cleanDate = (dateStr) => {
    if (!dateStr || dateStr === "undefined") {
      console.error("❌ CRITICAL: Found undefined date in segment!");
      return "";
    }
    return dateStr.split(".")[0];
  };

  const flightSegmentsXML = selectedFlight.segments
    .map(
      (seg, index) => `
    <air:AirSegment
      Key="${seg.key || "seg_" + index}"
      Group="${seg.group !== undefined ? seg.group : 0}"  
      Carrier="${seg.carrier}"
      FlightNumber="${seg.flightNumber}"
      Origin="${seg.from}"
      Destination="${seg.to}"
      DepartureTime="${cleanDate(seg.departure)}"
      ArrivalTime="${cleanDate(seg.arrival)}"
      ProviderCode="${seg.providerCode || "1G"}"
    />`
    )
    .join("");

  const passengersXML = passengers
    .map(
      (p, idx) => `
    <com:SearchPassenger
        Code="${p.type}"
        Key="P${idx + 1}"
    />`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <air:AirPriceReq
        xmlns:air="http://www.travelport.com/schema/air_v54_0"
        xmlns:com="http://www.travelport.com/schema/common_v54_0"
        TraceId="trace-${Date.now()}"
        AuthorizedBy="user"
        TargetBranch="P7219240">
      <com:BillingPointOfSaleInfo OriginApplication="uAPI"/>

      <air:AirItinerary>
        ${flightSegmentsXML}
      </air:AirItinerary>
        ${passengersXML}

      <air:AirPricingCommand>
        <air:AirPricingModifiers LowerPriorityDeclaration="true" />
      </air:AirPricingCommand>
    </air:AirPriceReq>
  </soap:Body>
</soap:Envelope>`;
};

// export function parseAirPriceResponse(xmlResponse, originalFlight) {
//   return new Promise((resolve, reject) => {
//     parseString(xmlResponse, { explicitArray: false }, (err, parsedResult) => {
//       if (err) return reject(err);
//       debugger;
//       try {
//         const envelope =
//           parsedResult["SOAP:Envelope"] || parsedResult["soap:Envelope"];
//         const body = envelope
//           ? envelope["SOAP:Body"] || envelope["soap:Body"]
//           : null;

//         if (!body) throw new Error("SOAP:Body not found in response");

//         const fault = body["SOAP:Fault"] || body["soap:Fault"];
//         if (fault) {
//           throw new Error(`SOAP Fault: ${fault.faultstring || "Unknown"}`);
//         }

//         const priceRsp =
//           body["air:AirPriceRsp"] ||
//           body["AirPriceRsp"] ||
//           body["ns2:AirPriceRsp"];
//         if (!priceRsp) throw new Error("AirPriceRsp not found");

//         const priceResult =
//           priceRsp["air:AirPriceResult"] ||
//           priceRsp["AirPriceResult"] ||
//           priceRsp["ns2:AirPriceResult"];
//         if (!priceResult) throw new Error("AirPriceResult missing.");

//         // Get AirItinerary segments
//         const airItinerary =
//           priceRsp["air:AirItinerary"] ||
//           priceRsp["AirItinerary"] ||
//           priceRsp["ns2:AirItinerary"];
//         const segmentsRaw = airItinerary
//           ? airItinerary["air:AirSegment"] ||
//             airItinerary["AirSegment"] ||
//             airItinerary["ns2:AirSegment"]
//           : null;
//         const segments = segmentsRaw
//           ? Array.isArray(segmentsRaw)
//             ? segmentsRaw
//             : [segmentsRaw]
//           : [];

//         // Get AirPricingSolution
//         const pricingSolutionRaw =
//           priceResult["air:AirPricingSolution"] ||
//           priceResult["AirPricingSolution"] ||
//           priceResult["ns2:AirPricingSolution"];
//         const pricingSolution = Array.isArray(pricingSolutionRaw)
//           ? pricingSolutionRaw
//           : [pricingSolutionRaw];

//         if (!pricingSolution) throw new Error("No pricing solutions found.");

//         // ✅ FIXED: There's only ONE AirPricingInfo with multiple FareInfo nodes
//         const pricingInfoRaw =
//           pricingSolution["air:AirPricingInfo"] ||
//           pricingSolution["AirPricingInfo"] ||
//           pricingSolution["ns2:AirPricingInfo"];

//         // Handle single or array (should be single for multi-city)
//         const pricingInfo = Array.isArray(pricingInfoRaw)
//           ? pricingInfoRaw[0]
//           : pricingInfoRaw;

//         if (!pricingInfo) throw new Error("No AirPricingInfo found.");

//         const cleanPrice = (val) => (val ? val.replace(/[^\d.]/g, "") : "0");

//         // ✅ FIXED: Get pricing from the single AirPricingInfo node
//         const attrs = pricingInfo.$;
//         const totalFare = parseFloat(cleanPrice(attrs.TotalPrice));
//         const baseFare = parseFloat(
//           cleanPrice(attrs.EquivalentBasePrice || attrs.BasePrice)
//         );
//         const totalTax = parseFloat(cleanPrice(attrs.Taxes));
//         const currency = attrs.TotalPrice
//           ? attrs.TotalPrice.substring(0, 3)
//           : "PKR";

//         // ✅ FIXED: Extract ALL FareInfo nodes (one per leg)
//         const fareInfoRaw =
//           pricingInfo["air:FareInfo"] ||
//           pricingInfo["FareInfo"] ||
//           pricingInfo["ns2:FareInfo"];
//         const fareInfos = Array.isArray(fareInfoRaw)
//           ? fareInfoRaw
//           : [fareInfoRaw];

//         // ✅ FIXED: Extract ALL BookingInfo nodes (one per segment)
//         const bookingInfoRaw =
//           pricingInfo["air:BookingInfo"] ||
//           pricingInfo["BookingInfo"] ||
//           pricingInfo["ns2:BookingInfo"];
//         const bookingInfos = Array.isArray(bookingInfoRaw)
//           ? bookingInfoRaw
//           : [bookingInfoRaw];

//         // Get HostToken(s)
//         const hostTokenRaw =
//           pricingSolution["common_v54_0:HostToken"] ||
//           pricingSolution["common_v52_0:HostToken"] ||
//           pricingSolution["com:HostToken"] ||
//           pricingSolution["HostToken"];

//         // Handle multiple host tokens (one per fare component)
//         const hostTokens = Array.isArray(hostTokenRaw)
//           ? hostTokenRaw
//           : hostTokenRaw
//           ? [hostTokenRaw]
//           : [];

//         const hostTokenValues = hostTokens.map((token) =>
//           typeof token === "string" ? token : token?._
//         );

//         // ✅ Build complete TravelportData
//         const travelportData = {
//           pricePointKey: pricingSolution?.$?.Key,
//           pricingInfoKey: pricingInfo?.$?.Key,
//           totalPrice: totalFare.toFixed(2),
//           basePrice: baseFare.toFixed(2),
//           taxes: totalTax.toFixed(2),
//           currency: currency,
//           platingCarrier: attrs.PlatingCarrier,
//           hostTokens: hostTokenValues, // Array of host tokens

//           // ✅ FIXED: Store ALL fare infos with proper structure
//           fareInfos: fareInfos.map((fare) => ({
//             key: fare?.$?.Key || "",
//             fareBasis: fare?.$?.FareBasis || "",
//             passengerTypeCode: fare?.$?.PassengerTypeCode || "ADT",
//             origin: fare?.$?.Origin || "",
//             destination: fare?.$?.Destination || "",
//             effectiveDate: fare?.$?.EffectiveDate || "",
//             departureDate: fare?.$?.DepartureDate || "",
//             amount: cleanPrice(fare?.$?.Amount || "0"),
//           })),
//         };

//         // ✅ Map segments with their booking info
//         const updatedSegments =
//           segments.length > 0
//             ? segments.map((seg) => {
//                 const segKey = seg?.$?.Key;
//                 const bInfo = bookingInfos.find(
//                   (bi) => bi?.$?.SegmentRef === segKey
//                 );
//                 return {
//                   key: segKey,
//                   group: seg?.$?.Group || "0",
//                   carrier: seg?.$?.Carrier,
//                   flightNumber: seg?.$?.FlightNumber,
//                   from: seg?.$?.Origin,
//                   to: seg?.$?.Destination,
//                   departure: seg?.$?.DepartureTime,
//                   arrival: seg?.$?.ArrivalTime,
//                   classOfService: seg?.$?.ClassOfService,
//                   providerCode: seg?.$?.ProviderCode || "1G",
//                   bookingCode: bInfo?.$?.BookingCode,
//                   cabinClass: bInfo?.$?.CabinClass,
//                   fareInfoRef: bInfo?.$?.FareInfoRef || "", // ✅ ADD: Link to FareInfo
//                 };
//               })
//             : originalFlight.segments;

//         resolve({
//           ...originalFlight,
//           travelportData,
//           segments: updatedSegments,
//         });
//       } catch (parseError) {
//         console.error("❌ Parser Error:", parseError.message);
//         reject(parseError);
//       }
//     });
//   });
// }
export function parseAirPriceResponse(xmlResponse, originalFlight) {
  return new Promise((resolve, reject) => {
    parseString(xmlResponse, { explicitArray: false }, (err, parsedResult) => {
      if (err) return reject(err);

      try {
        // 1. Extract SOAP Envelope and Body
        const envelope =
          parsedResult["SOAP:Envelope"] || parsedResult["soap:Envelope"];
        const body = envelope
          ? envelope["SOAP:Body"] || envelope["soap:Body"]
          : null;

        if (!body) throw new Error("SOAP:Body not found in response");

        // 2. Check for SOAP Faults
        const fault = body["SOAP:Fault"] || body["soap:Fault"];
        if (fault) {
          throw new Error(`SOAP Fault: ${fault.faultstring || "Unknown"}`);
        }

        // 3. Get AirPriceRsp
        const priceRsp =
          body["air:AirPriceRsp"] ||
          body["AirPriceRsp"] ||
          body["ns2:AirPriceRsp"];
        if (!priceRsp) throw new Error("AirPriceRsp not found");

        // 4. Get AirPriceResult
        const priceResult =
          priceRsp["air:AirPriceResult"] ||
          priceRsp["AirPriceResult"] ||
          priceRsp["ns2:AirPriceResult"];
        if (!priceResult) throw new Error("AirPriceResult missing");

        // 5. Extract AirItinerary Segments
        const airItinerary =
          priceRsp["air:AirItinerary"] ||
          priceRsp["AirItinerary"] ||
          priceRsp["ns2:AirItinerary"];
        const segmentsRaw = airItinerary
          ? airItinerary["air:AirSegment"] ||
            airItinerary["AirSegment"] ||
            airItinerary["ns2:AirSegment"]
          : null;
        const segments = segmentsRaw
          ? Array.isArray(segmentsRaw)
            ? segmentsRaw
            : [segmentsRaw]
          : [];

        // 6. Get ALL AirPricingSolutions
        const pricingSolutionRaw =
          priceResult["air:AirPricingSolution"] ||
          priceResult["AirPricingSolution"] ||
          priceResult["ns2:AirPricingSolution"];

        const pricingSolutions = Array.isArray(pricingSolutionRaw)
          ? pricingSolutionRaw
          : [pricingSolutionRaw];

        if (!pricingSolutions || pricingSolutions.length === 0) {
          throw new Error("No pricing solutions found");
        }

        // 7. Match the correct pricing solution by fare basis
        // const originalFareBasis =
        //   originalFlight.travelportData?.fareInfos?.[0]?.fareBasis;

        // console.log(
        //   `🔍 Searching for pricing solution matching fare: ${originalFareBasis}`
        // );

        // const pricingSolution =
        //   pricingSolutions.find((solution) => {
        //     const pricingInfo = Array.isArray(solution["air:AirPricingInfo"])
        //       ? solution["air:AirPricingInfo"][0]
        //       : solution["air:AirPricingInfo"];

        //     const fareInfo = Array.isArray(pricingInfo?.["air:FareInfo"])
        //       ? pricingInfo["air:FareInfo"][0]
        //       : pricingInfo?.["air:FareInfo"];

        //     const fareBasis = fareInfo?.$?.FareBasis;
        //     console.log(
        //       `  ↳ Checking solution: ${fareBasis} (${solution.$?.TotalPrice})`
        //     );

        //     return fareBasis === originalFareBasis;
        //   }) || pricingSolutions[0]; // Fallback to first solution if no match
        // 7. Match the correct pricing solution by fare basis
        const originalFareBasis =
          originalFlight.travelportData?.fareInfos?.[0]?.fareBasis;
        const originalPrice =
          originalFlight.displayPrice ||
          originalFlight.travelportData?.totalPrice;

        console.log(
          `🔍 Searching for pricing solution matching fare: ${originalFareBasis} (Expected: ${originalPrice})`
        );

        const pricingSolution =
          pricingSolutions.find((solution) => {
            const pricingInfo = Array.isArray(solution["air:AirPricingInfo"])
              ? solution["air:AirPricingInfo"][0]
              : solution["air:AirPricingInfo"];

            const fareInfo = Array.isArray(pricingInfo?.["air:FareInfo"])
              ? pricingInfo["air:FareInfo"][0]
              : pricingInfo?.["air:FareInfo"];

            const fareBasis = fareInfo?.$?.FareBasis;
            const solutionPrice = solution.$?.TotalPrice;

            console.log(
              `  ↳ Checking solution: ${fareBasis} (${solutionPrice})`
            );

            // Try exact match first
            if (fareBasis === originalFareBasis) return true;

            // If no exact match, try fuzzy matching (last 6 characters usually match)
            if (
              fareBasis &&
              originalFareBasis &&
              fareBasis.slice(-6) === originalFareBasis.slice(-6)
            ) {
              console.log(
                `  ✓ Fuzzy match found: ${fareBasis} ≈ ${originalFareBasis}`
              );
              return true;
            }

            return false;
          }) ||
          pricingSolutions.find((solution) => {
            // Fallback: find closest price match
            const cleanOriginalPrice = parseFloat(
              String(originalPrice).replace(/[^\d.]/g, "")
            );
            const solutionPrice = parseFloat(
              solution.$?.TotalPrice?.replace(/[^\d.]/g, "") || "0"
            );
            const priceDiff = Math.abs(cleanOriginalPrice - solutionPrice);

            if (priceDiff < 5000) {
              // Within 5000 PKR
              console.log(
                `  ↳ Price match found: ${solutionPrice} ≈ ${cleanOriginalPrice} (diff: ${priceDiff})`
              );
              return true;
            }
            return false;
          }) ||
          pricingSolutions[0]; // Last resort: first solution
        if (!pricingSolution)
          throw new Error("No valid pricing solution found");

        console.log(
          `✅ Selected pricing solution: ${pricingSolution.$?.TotalPrice}`
        );

        // 8. Extract AirPricingInfo
        const pricingInfoRaw =
          pricingSolution["air:AirPricingInfo"] ||
          pricingSolution["AirPricingInfo"] ||
          pricingSolution["ns2:AirPricingInfo"];

        const pricingInfo = Array.isArray(pricingInfoRaw)
          ? pricingInfoRaw[0]
          : pricingInfoRaw;

        if (!pricingInfo) throw new Error("No AirPricingInfo found");

        // 9. Helper function to clean price strings
        const cleanPrice = (val) => (val ? val.replace(/[^\d.]/g, "") : "0");

        // 10. Extract pricing details
        const attrs = pricingInfo.$;
        const totalFare = parseFloat(cleanPrice(attrs.TotalPrice));
        const baseFare = parseFloat(
          cleanPrice(attrs.EquivalentBasePrice || attrs.BasePrice)
        );
        const totalTax = parseFloat(cleanPrice(attrs.Taxes));
        const currency = attrs.TotalPrice
          ? attrs.TotalPrice.substring(0, 3)
          : "PKR";

        // 11. Extract FareInfo nodes
        const fareInfoRaw =
          pricingInfo["air:FareInfo"] ||
          pricingInfo["FareInfo"] ||
          pricingInfo["ns2:FareInfo"];
        const fareInfos = Array.isArray(fareInfoRaw)
          ? fareInfoRaw
          : [fareInfoRaw];

        // 12. Extract BookingInfo nodes
        const bookingInfoRaw =
          pricingInfo["air:BookingInfo"] ||
          pricingInfo["BookingInfo"] ||
          pricingInfo["ns2:BookingInfo"];
        const bookingInfos = Array.isArray(bookingInfoRaw)
          ? bookingInfoRaw
          : [bookingInfoRaw];

        // 13. Extract HostToken(s)
        const hostTokenRaw =
          pricingSolution["common_v54_0:HostToken"] ||
          pricingSolution["common_v52_0:HostToken"] ||
          pricingSolution["com:HostToken"] ||
          pricingSolution["HostToken"];

        const hostTokens = Array.isArray(hostTokenRaw)
          ? hostTokenRaw
          : hostTokenRaw
          ? [hostTokenRaw]
          : [];

        const hostTokenValues = hostTokens.map((token) =>
          typeof token === "string" ? token : token?._
        );

        // 14. Build complete TravelportData object
        const travelportData = {
          pricePointKey: pricingSolution?.$?.Key,
          pricingInfoKey: pricingInfo?.$?.Key,
          totalPrice: totalFare.toFixed(2),
          basePrice: baseFare.toFixed(2),
          taxes: totalTax.toFixed(2),
          currency: currency,
          platingCarrier: attrs.PlatingCarrier,
          pricingMethod: attrs.PricingMethod,
          latestTicketingTime: attrs.LatestTicketingTime,
          providerCode: attrs.ProviderCode,
          hostTokens: hostTokenValues,
          fareInfos: fareInfos.map((fare) => ({
            key: fare?.$?.Key || "",
            fareBasis: fare?.$?.FareBasis || "",
            passengerTypeCode: fare?.$?.PassengerTypeCode || "ADT",
            origin: fare?.$?.Origin || "",
            destination: fare?.$?.Destination || "",
            effectiveDate: fare?.$?.EffectiveDate || "",
            departureDate: fare?.$?.DepartureDate || "",
            amount: cleanPrice(fare?.$?.Amount || "0"),
          })),
        };

        // 15. Map segments with their booking info
        const updatedSegments =
          segments.length > 0
            ? segments.map((seg) => {
                const segKey = seg?.$?.Key;
                const bInfo = bookingInfos.find(
                  (bi) => bi?.$?.SegmentRef === segKey
                );
                return {
                  key: segKey,
                  group: seg?.$?.Group || "0",
                  carrier: seg?.$?.Carrier,
                  flightNumber: seg?.$?.FlightNumber,
                  from: seg?.$?.Origin,
                  to: seg?.$?.Destination,
                  departure: seg?.$?.DepartureTime,
                  arrival: seg?.$?.ArrivalTime,
                  classOfService:
                    seg?.$?.ClassOfService || bInfo?.$?.BookingCode,
                  providerCode: seg?.$?.ProviderCode || "1G",
                  bookingCode: bInfo?.$?.BookingCode,
                  cabinClass: bInfo?.$?.CabinClass,
                  fareInfoRef: bInfo?.$?.FareInfoRef || "",
                };
              })
            : originalFlight.segments;

        // 16. Log successful parsing
        console.log(
          `✅ Parsed AirPrice: ${currency}${totalFare.toFixed(
            2
          )} (Base: ${baseFare.toFixed(2)}, Tax: ${totalTax.toFixed(2)})`
        );

        // 17. Return enriched flight object
        resolve({
          ...originalFlight,
          travelportData,
          segments: updatedSegments,
        });
      } catch (parseError) {
        console.error("❌ AirPrice Parse Error:", parseError.message);
        reject(parseError);
      }
    });
  });
}
