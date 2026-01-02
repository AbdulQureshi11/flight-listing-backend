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

// 2️⃣ LowFareSearch XML builder
export const buildLowFareSearchXML = ({
  from,
  to,
  departureDate,
  adults = 1,
  targetBranch,
}) => {
  const formattedDepartureDate = formatDate(departureDate);

  if (!formattedDepartureDate) throw new Error("Invalid departure date");
  if (!from || !to) throw new Error("Origin and destination required");
  if (!targetBranch) throw new Error("Target branch required");

  // Generate passengers XML dynamically
  const passengersXML = Array.from({ length: adults })
    .map(
      () =>
        `<SearchPassenger xmlns="http://www.travelport.com/schema/common_v52_0" Code="ADT"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:air="http://www.travelport.com/schema/air_v52_0"
                  xmlns:com="http://www.travelport.com/schema/common_v52_0">
  <soapenv:Header/>
  <soapenv:Body>
    <LowFareSearchReq xmlns="http://www.travelport.com/schema/air_v52_0" 
                      TraceId="${crypto.randomUUID()}"
                      TargetBranch="${targetBranch}" 
                      ReturnUpsellFare="true">

      <BillingPointOfSaleInfo xmlns="http://www.travelport.com/schema/common_v52_0" OriginApplication="uAPI"/>

      <SearchAirLeg>
        <SearchOrigin>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v52_0" Code="${from}" PreferCity="true"/>
        </SearchOrigin>
        <SearchDestination>
          <CityOrAirport xmlns="http://www.travelport.com/schema/common_v52_0" Code="${to}" PreferCity="true"/>
        </SearchDestination>
        <SearchDepTime PreferredTime="${formattedDepartureDate}"/>
      </SearchAirLeg>

      <AirSearchModifiers>
        <PreferredProviders>
          <Provider xmlns="http://www.travelport.com/schema/common_v52_0" Code="1G"/>
        </PreferredProviders>
      </AirSearchModifiers>

      ${passengersXML}

      <AirPricingModifiers>
        <AccountCodes>
          <AccountCode xmlns="http://www.travelport.com/schema/common_v52_0" Code="-"/>
        </AccountCodes>
      </AirPricingModifiers>

    </LowFareSearchReq>
  </soapenv:Body>
</soapenv:Envelope>`;
};
