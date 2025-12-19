export const buildLowFareSearchXML = ({
  from,
  to,
  date,
  adults,
  targetBranch
}) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:air="http://www.travelport.com/schema/air_v42_0"
                  xmlns:com="http://www.travelport.com/schema/common_v42_0">
  <soapenv:Header/>
  <soapenv:Body>
    <air:LowFareSearchReq
        AuthorizedBy="user"
        TargetBranch="${targetBranch}"
        TraceId="TRACE${Date.now()}"
        SolutionResult="true"
        ReturnUpsellFare="true">

      <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>

      <air:SearchAirLeg>
        <air:SearchOrigin>
          <com:Airport Code="${from}"/>
        </air:SearchOrigin>
        <air:SearchDestination>
          <com:Airport Code="${to}"/>
        </air:SearchDestination>
        <air:SearchDepTime PreferredTime="${date}"/>
      </air:SearchAirLeg>

      <!-- ✅ IMPORTANT: MaxSolutions -->
      <air:AirSearchModifiers MaxSolutions="50">
        <air:PreferredProviders>
          <com:Provider Code="1G"/>
        </air:PreferredProviders>
      </air:AirSearchModifiers>

      ${Array.from({ length: adults })
    .map(() => `<com:SearchPassenger Code="ADT"/>`)
    .join("")}

      <!-- ✅ Price in PKR if allowed by PCC -->
      <air:AirPricingModifiers FaresIndicator="AllFares" CurrencyType="PKR"/>

    </air:LowFareSearchReq>
  </soapenv:Body>
</soapenv:Envelope>`;
