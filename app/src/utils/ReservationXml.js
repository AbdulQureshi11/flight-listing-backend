// export const buildAirCreateReservationXML = (
//   selectedFlight,
//   passengers,
//   contactInfo,
//   formOfPayment
// ) => {
//   if (!selectedFlight || !selectedFlight.travelportData) {
//     throw new Error("Invalid selectedFlight data passed to XML builder");
//   }

//   const { travelportData, segments } = selectedFlight;
//   const today = new Date().toISOString().split("T")[0];

//   const formatGdsDate = (dateStr) => {
//     if (!dateStr) return "";
//     return dateStr.split(".")[0];
//   };

//   const ticketingDeadline = new Date();
//   ticketingDeadline.setHours(ticketingDeadline.getHours() + 24);
//   const formattedTicketDate = ticketingDeadline.toISOString().split(".")[0];

//   // ================== CONTINUITY CHECK LOGIC ==================
//   let continuityOverridesXML = "";

//   // Loop through segments starting from the second one (index 1)
//   for (let i = 1; i < segments.length; i++) {
//     const previousSegment = segments[i - 1];
//     const currentSegment = segments[i];

//     // If arrival city of previous doesn't match departure city of current
//     if (previousSegment.to !== currentSegment.from) {
//       console.log(
//         `⚠️ Continuity break detected: ${previousSegment.to} to ${currentSegment.from}. Adding override for key: ${currentSegment.key}`
//       );

//       continuityOverridesXML += `
//       <com:ContinuityCheckOverride Key="${currentSegment.key}">ARNK</com:ContinuityCheckOverride>`;
//     }
//   }
//   // ============================================================

//   const travelersXML = passengers
//     .map(
//       (p, idx) => `
//     <com:BookingTraveler Key="P${idx + 1}" TravelerType="${p.type}" Gender="${
//         p.gender
//       }" DOB="${p.dob}">
//       <com:BookingTravelerName First="${p.firstName.toUpperCase()}" Last="${p.lastName.toUpperCase()}" />
//       <com:PhoneNumber Number="${contactInfo.phone}" />
//       <com:Email EmailID="${contactInfo.email}" />
//     </com:BookingTraveler>`
//     )
//     .join("");

//   const airSegmentsXML = segments
//     .map(
//       (seg) => `
//     <air:AirSegment
//       Key="${seg.key}"
//       Group="${seg.group}"
//       Carrier="${seg.carrier}"
//       FlightNumber="${seg.flightNumber}"
//       Origin="${seg.from}"
//       Destination="${seg.to}"
//       DepartureTime="${formatGdsDate(seg.departure)}"
//       ArrivalTime="${formatGdsDate(seg.arrival)}"
//       ProviderCode="1G"
//     />`
//     )
//     .join("");

//   const fareInfosXML = (travelportData.fareInfos || [])
//     .map(
//       (fare) => `
//     <air:FareInfo
//       Key="${fare.key}"
//       FareBasis="${fare.fareBasis}"
//       PassengerTypeCode="${fare.passengerTypeCode}"
//       Origin="${fare.origin}"
//       Destination="${fare.destination}"
//       EffectiveDate="${fare.effectiveDate.split("T")[0]}"
//     />`
//     )
//     .join("");

//   const bookingInfoXML = segments
//     .map(
//       (seg) => `
//     <air:BookingInfo
//       BookingCode="${seg.bookingCode}"
//       BookingCount="1"
//       CabinClass="${seg.cabinClass}"
//       FareInfoRef="${seg.fareInfoRef}"
//       SegmentRef="${seg.key}"
//     />`
//     )
//     .join("");

//   const hostTokensXML = (travelportData.hostTokens || [])
//     .map((token) => `<com:HostToken>${token}</com:HostToken>`)
//     .join("");

//   return `<?xml version="1.0" encoding="UTF-8"?>
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
//                   xmlns:univ="http://www.travelport.com/schema/universal_v52_0"
//                   xmlns:air="http://www.travelport.com/schema/air_v52_0"
//                   xmlns:com="http://www.travelport.com/schema/common_v52_0">
//   <soapenv:Body>
//     <univ:AirCreateReservationReq AuthorizedBy="User" TargetBranch="${process.env.TRAVELPORT_TARGET_BRANCH}" RetainReservation="Both">
//       <com:BillingPointOfSaleInfo OriginApplication="uAPI"/>
//             ${travelersXML}
//             ${continuityOverridesXML}

//       <com:FormOfPayment Type="Cash"/>
//       <air:AirPricingSolution Key="${travelportData.pricePointKey}">
//         ${airSegmentsXML}
//         <air:AirPricingInfo Key="${travelportData.pricingInfoKey}" PlatingCarrier="${travelportData.platingCarrier}" PricingMethod="Auto">
//             ${fareInfosXML}
//             ${bookingInfoXML}
//             <air:PassengerType Code="ADT" />
//         </air:AirPricingInfo>
//         ${hostTokensXML}
//       </air:AirPricingSolution>
//       <com:ActionStatus Type="TAW" TicketDate="${formattedTicketDate}" ProviderCode="1G"/>
//     </univ:AirCreateReservationReq>
//   </soapenv:Body>
// </soapenv:Envelope>`;
// };

export const buildAirCreateReservationXML = (
  selectedFlight,
  passengers,
  contactInfo,
  formOfPayment
) => {
  if (!selectedFlight || !selectedFlight.travelportData) {
    throw new Error("Invalid selectedFlight data passed to XML builder");
  }

  const { travelportData, segments } = selectedFlight;

  const formatGdsDate = (dateStr) => {
    if (!dateStr) return "";
    return dateStr.split(".")[0];
  };

  const ticketingDeadline = new Date();
  ticketingDeadline.setHours(ticketingDeadline.getHours() + 24);
  const formattedTicketDate = ticketingDeadline.toISOString().split(".")[0];

  // 1. Travelers Section - Each gets a unique Key (P1, P2, P3...)
  const travelersXML = passengers
    .map(
      (p, idx) => `
    <com:BookingTraveler Key="P${idx + 1}" TravelerType="${p.type}" Gender="${
        p.gender
      }" DOB="${p.dob}">
      <com:BookingTravelerName First="${p.firstName.toUpperCase()}" Last="${p.lastName.toUpperCase()}" />
      <com:PhoneNumber Number="${contactInfo.phone}" />
      <com:Email EmailID="${contactInfo.email}" />
    </com:BookingTraveler>`
    )
    .join("");

  // 2. Air Segments
  const airSegmentsXML = segments
    .map(
      (seg) => `
    <air:AirSegment
      Key="${seg.key}"
      Group="${seg.group}"
      Carrier="${seg.carrier}"
      FlightNumber="${seg.flightNumber}"
      Origin="${seg.from}"
      Destination="${seg.to}"
      DepartureTime="${formatGdsDate(seg.departure)}"
      ArrivalTime="${formatGdsDate(seg.arrival)}"
      ProviderCode="1G"
    />`
    )
    .join("");

  // 3. Fare Info
  const fareInfosXML = (travelportData.fareInfos || [])
    .map(
      (fare) => `
    <air:FareInfo 
      Key="${fare.key}" 
      FareBasis="${fare.fareBasis}" 
      PassengerTypeCode="${fare.passengerTypeCode}" 
      Origin="${fare.origin}" 
      Destination="${fare.destination}" 
      EffectiveDate="${
        fare.effectiveDate?.split("T")[0] ||
        new Date().toISOString().split("T")[0]
      }" 
    />`
    )
    .join("");

  // 4. Booking Info
  const bookingInfoXML = segments
    .map(
      (seg) => `
    <air:BookingInfo 
      BookingCode="${seg.bookingCode}" 
      BookingCount="${passengers.length}" 
      CabinClass="${seg.cabinClass}" 
      FareInfoRef="${seg.fareInfoRef}" 
      SegmentRef="${seg.key}" 
    />`
    )
    .join("");

  const pricingMappingXML = passengers
    .map(
      (p, idx) => `
    <air:PassengerType 
      Code="${p.type}" 
      BookingTravelerRef="P${idx + 1}" 
    />`
    )
    .join("");

  const hostTokensXML = (travelportData.hostTokens || [])
    .map((token) => `<com:HostToken>${token}</com:HostToken>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:univ="http://www.travelport.com/schema/universal_v54_0" 
                  xmlns:air="http://www.travelport.com/schema/air_v54_0" 
                  xmlns:com="http://www.travelport.com/schema/common_v54_0">
  <soapenv:Body>
    <univ:AirCreateReservationReq AuthorizedBy="User" TargetBranch="${process.env.TRAVELPORT_TARGET_BRANCH}" RetainReservation="Both">
      <com:BillingPointOfSaleInfo OriginApplication="uAPI"/>
      ${travelersXML}
      <com:FormOfPayment Type="Cash"/>
      <air:AirPricingSolution Key="${travelportData.pricePointKey}">
        ${airSegmentsXML}
        <air:AirPricingInfo Key="${travelportData.pricingInfoKey}" PlatingCarrier="${travelportData.platingCarrier}" PricingMethod="Auto">
          ${fareInfosXML}
          ${bookingInfoXML}
          ${pricingMappingXML}
          
        </air:AirPricingInfo>
        ${hostTokensXML}
      </air:AirPricingSolution>
      <com:ActionStatus Type="TAW" TicketDate="${formattedTicketDate}" ProviderCode="1G"/>
    </univ:AirCreateReservationReq>
  </soapenv:Body>
</soapenv:Envelope>`;
};
