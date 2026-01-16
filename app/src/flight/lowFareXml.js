// 1️⃣ Date formatting helper
export const formatDate = (date) => {
  if (!date) return null;

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// 2️⃣ LowFareSearch XML builder with multi-city support
export const buildLowFareSearchXML = ({
  from,
  to,
  departureDate,
  returnDate, // Optional for round-trip
  segments, // Array for multi-city: [{from, to, date}, ...]
  adults = 1,
  children = 0,
  infants = 0,
  cabinClass = "Economy",
  targetBranch,
  currency = "PKR",
}) => {
  if (!targetBranch) throw new Error("Target branch required");

  // Determine search type: multi-city or single/round-trip
  const isMultiCity = Array.isArray(segments) && segments.length >= 2;

  let searchLegsXML = "";

  if (isMultiCity) {
    // Multi-city: build legs from segments array
    if (segments.length < 2) {
      throw new Error("Multi-city requires at least 2 segments");
    }

    searchLegsXML = segments
      .map((seg) => {
        const formattedDate = formatDate(seg.date);
        if (!formattedDate)
          throw new Error(`Invalid date in segment: ${JSON.stringify(seg)}`);
        if (!seg.from || !seg.to)
          throw new Error(`Invalid segment: ${JSON.stringify(seg)}`);

        return `<SearchAirLeg>
        <SearchOrigin>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${seg.from}" PreferCity="true"/>
        </SearchOrigin>
        <SearchDestination>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${seg.to}" PreferCity="true"/>
        </SearchDestination>
        <SearchDepTime PreferredTime="${formattedDate}"/>
      </SearchAirLeg>`;
      })
      .join("\n");
  } else {
    // One-way or Round-trip
    const formattedDepartureDate = formatDate(departureDate);

    if (!formattedDepartureDate) throw new Error("Invalid departure date");
    if (!from || !to) throw new Error("Origin and destination required");

    // Outbound leg
    searchLegsXML = `<SearchAirLeg>
        <SearchOrigin>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${from}" PreferCity="true"/>
        </SearchOrigin>
        <SearchDestination>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${to}" PreferCity="true"/>
        </SearchDestination>
        <SearchDepTime PreferredTime="${formattedDepartureDate}"/>
      </SearchAirLeg>`;

    // Return leg (if provided)
    if (returnDate) {
      const formattedReturnDate = formatDate(returnDate);
      if (!formattedReturnDate) throw new Error("Invalid return date");

      searchLegsXML += `
      <SearchAirLeg>
        <SearchOrigin>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${to}" PreferCity="true"/>
        </SearchOrigin>
        <SearchDestination>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v54_0" Code="${from}" PreferCity="true"/>
        </SearchDestination>
        <SearchDepTime PreferredTime="${formattedReturnDate}"/>
      </SearchAirLeg>`;
    }
  }

  const passengersXML = [
    ...Array.from(
      { length: adults },
      () =>
        `<SearchPassenger xmlns="http://www.travelport.com/schema/common_v54_0" Code="ADT"/>`
    ),
    ...Array.from(
      { length: children },
      () =>
        `<SearchPassenger xmlns="http://www.travelport.com/schema/common_v54_0" Code="CNN"/>`
    ),
    ...Array.from(
      { length: infants },
      () =>
        `<SearchPassenger xmlns="http://www.travelport.com/schema/common_v54_0" Code="INF"/>`
    ),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:air="http://www.travelport.com/schema/air_v54_0"
                  xmlns:com="http://www.travelport.com/schema/common_v54_0">
  <soapenv:Header/>
  <soapenv:Body>
    <LowFareSearchReq xmlns="http://www.travelport.com/schema/air_v54_0"
                       TraceId="${crypto.randomUUID()}"
                      TargetBranch="${targetBranch}"
                       ReturnUpsellFare="true"
                      ReturnAmenities="true">
       <BillingPointOfSaleInfo xmlns="http://www.travelport.com/schema/common_v54_0" OriginApplication="uAPI"/>
       ${searchLegsXML}
       <AirSearchModifiers MaxSolutions="2" InventoryRequestType="Direct" CabinClass="${cabinClass}">
        <PreferredProviders>
          <Provider xmlns="http://www.travelport.com/schema/common_v54_0" Code="1G"/>
        </PreferredProviders>
        <air:FlightType MaxConnections="2"/>
      </AirSearchModifiers>
       ${passengersXML}
       <AirPricingModifiers FaresIndicator="AllFares" CurrencyType="${currency}">
        <AccountCodes>
          <AccountCode xmlns="http://www.travelport.com/schema/common_v54_0" Code="-"/>
        </AccountCodes>
      </AirPricingModifiers>
     </LowFareSearchReq>
  </soapenv:Body>
</soapenv:Envelope>`;
};
