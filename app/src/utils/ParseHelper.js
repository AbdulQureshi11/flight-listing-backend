import { XMLParser } from "fast-xml-parser";

// ==================== XML PARSER ====================
export const parseXMLToJSON = (xmlString) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  return parser.parse(xmlString);
};

// ==================== EXTRACT FUNCTIONS ====================

// Extract AirSegments into a map
export const extractAirSegments = (rsp) => {
  let segments =
    rsp["air:AirSegmentList"]?.["air:AirSegment"] ||
    rsp.AirSegmentList?.AirSegment ||
    [];
  segments = Array.isArray(segments) ? segments : [segments];

  const map = {};
  for (const seg of segments) {
    if (!seg?.["@_Key"]) continue;

    const providerCode =
      seg["air:AirAvailInfo"]?.["@_ProviderCode"] ||
      seg.AirAvailInfo?.["@_ProviderCode"];

    map[seg["@_Key"]] = {
      key: seg["@_Key"],
      group: seg["@_Group"] || "0",
      carrier: seg["@_Carrier"] || "",
      flightNumber: seg["@_FlightNumber"] || "",
      from: seg["@_Origin"] || "",
      to: seg["@_Destination"] || "",
      departure: seg["@_DepartureTime"] || "",
      arrival: seg["@_ArrivalTime"] || "",
      flightTime: parseInt(seg["@_FlightTime"] || "0"),
      distance: seg["@_Distance"] || "0",
      equipment: seg["@_Equipment"] || "",
      providerCode: providerCode,
    };
  }

  return map;
};

// Extract FareInfo into a map
export const extractFareInfo = (rsp) => {
  let fareInfos =
    rsp["air:FareInfoList"]?.["air:FareInfo"] ||
    rsp.FareInfoList?.FareInfo ||
    [];
  fareInfos = Array.isArray(fareInfos) ? fareInfos : [fareInfos];

  const map = {};
  for (const fare of fareInfos) {
    if (!fare?.["@_Key"]) continue;

    const baggage = fare["air:BaggageAllowance"];
    const brand = fare["air:Brand"];

    map[fare["@_Key"]] = {
      key: fare["@_Key"],
      fareBasis: fare["@_FareBasis"] || "",
      passengerTypeCode: fare["@_PassengerTypeCode"] || "",
      origin: fare["@_Origin"] || "",
      destination: fare["@_Destination"] || "",
      effectiveDate: fare["@_EffectiveDate"] || "",
      departureDate: fare["@_DepartureDate"] || "",
      notValidBefore: fare["@_NotValidBefore"] || "",
      notValidAfter: fare["@_NotValidAfter"] || "",
      amount: fare["@_Amount"] || "", // ✅ ADD: Individual fare amount
      baggage: baggage
        ? {
            maxWeight: baggage["air:MaxWeight"]?.["@_Value"] || "",
            unit: baggage["air:MaxWeight"]?.["@_Unit"] || "",
          }
        : null,
      brand: brand
        ? {
            key: brand["@_Key"] || "",
            brandID: brand["@_BrandID"] || "",
            name: brand["@_Name"] || "",
            brandFound: brand["@_BrandFound"] === "true",
          }
        : null,
    };
  }

  return map;
};

// Extract Amenities into a map
export const extractAmenities = (rsp) => {
  let amenitiesList =
    rsp["air:AmenitiesList"]?.["air:Amenities"] ||
    rsp.AmenitiesList?.Amenities ||
    [];
  amenitiesList = Array.isArray(amenitiesList)
    ? amenitiesList
    : [amenitiesList];

  const map = {};
  for (const amenity of amenitiesList) {
    if (!amenity?.["@_Key"]) continue;

    let texts = amenity["air:Text"] || [];
    texts = Array.isArray(texts) ? texts : [texts];

    map[amenity["@_Key"]] = texts.map((t) => ({
      type: t["@_Type"] || "",
      value: t["#text"] || "",
    }));
  }

  return map;
};

// Extract Brand details from BrandList
export const extractBrands = (rsp) => {
  let brands =
    rsp["air:BrandList"]?.["air:Brand"] || rsp.BrandList?.Brand || [];
  brands = Array.isArray(brands) ? brands : [brands];

  const map = {};
  for (const brand of brands) {
    if (!brand?.["@_Key"]) continue;

    let titles = brand["air:Title"] || [];
    titles = Array.isArray(titles) ? titles : [titles];

    let texts = brand["air:Text"] || [];
    texts = Array.isArray(texts) ? texts : [texts];

    map[brand["@_Key"]] = {
      key: brand["@_Key"],
      brandID: brand["@_BrandID"] || "",
      name: brand["@_Name"] || "",
      carrier: brand["@_Carrier"] || "",
      titles: titles.map((t) => ({
        type: t["@_Type"],
        language: t["@_LanguageCode"],
        text: t["#text"],
      })),
      texts: texts.map((t) => ({
        type: t["@_Type"],
        language: t["@_LanguageCode"],
        text: t["#text"],
      })),
    };
  }

  return map;
};

// Process a single AirPricePoint into a flight object
// export const processPricePoint = (
//   pricePoint,
//   segmentMap,
//   fareInfoMap,
//   amenitiesMap,
//   brandMap
// ) => {
//   // 1. Handle AirPricingInfo as an array (Support multiple passenger types)
//   let pricingInfoList =
//     pricePoint["air:AirPricingInfo"] || pricePoint.AirPricingInfo;
//   if (!pricingInfoList) return null;
//   pricingInfoList = Array.isArray(pricingInfoList)
//     ? pricingInfoList
//     : [pricingInfoList];

//   // We use the first pricing block to extract flight/segment details
//   // (Usually segments are the same across pricing blocks in one PricePoint)
//   const primaryPricing = pricingInfoList[0];

//   // Get flight options from primary
//   const flightOptions =
//     primaryPricing["air:FlightOptionsList"]?.["air:FlightOption"];
//   if (!flightOptions) return null;

//   const flightOptionsList = Array.isArray(flightOptions)
//     ? flightOptions
//     : [flightOptions];

//   const segments = [];
//   const segmentKeys = [];
//   const fareInfoRefs = new Set();
//   const amenitiesRefs = [];

//   for (const flightOption of flightOptionsList) {
//     const optionDetails = flightOption["air:Option"];
//     const opts = Array.isArray(optionDetails) ? optionDetails : [optionDetails];
//     const selectedOption = opts[0];
//     if (!selectedOption) continue;

//     let bookingInfos = selectedOption["air:BookingInfo"];
//     if (!bookingInfos) continue;
//     bookingInfos = Array.isArray(bookingInfos) ? bookingInfos : [bookingInfos];

//     for (const booking of bookingInfos) {
//       const segKey = booking["@_SegmentRef"];
//       if (!segKey || !segmentMap[segKey]) continue;

//       const segment = segmentMap[segKey];
//       segments.push({
//         ...segment,
//         bookingCode: booking["@_BookingCode"],
//         cabinClass: booking["@_CabinClass"],
//         bookingCount: booking["@_BookingCount"],
//         classOfService: booking["@_BookingCode"],
//         segmentKey: segKey,
//         fareInfoRef: booking["@_FareInfoRef"] || "",
//       });

//       segmentKeys.push(segKey);
//       if (booking["@_FareInfoRef"]) fareInfoRefs.add(booking["@_FareInfoRef"]);
//       if (booking["@_AmenitiesRef"])
//         amenitiesRefs.push(booking["@_AmenitiesRef"]);
//     }
//   }

//   if (segments.length === 0) return null;

//   // 2. AGGREGATE PRICING (ADT + CNN + INF)
//   let totalAmount = 0;
//   let baseAmount = 0;
//   let taxAmount = 0;
//   let currency = "PKR";
//   const passengerBreakdown = [];

//   pricingInfoList.forEach((info) => {
//     const paxes = info["air:PassengerType"];
//     const paxesList = Array.isArray(paxes) ? paxes : [paxes];
//     const unitPrice = parsePrice(info["@_TotalPrice"]).amount;

//     // Count how many passengers are in this specific pricing block
//     const paxCount = paxesList.length;

//     const currentTotal = parsePrice(info["@_TotalPrice"]);
//     const currentBase = parsePrice(
//       info["@_BasePrice"] || info["@_EquivalentBasePrice"]
//     );
//     const currentTaxes = parsePrice(info["@_Taxes"]);

//     if (currentTotal.amount) {
//       totalAmount += currentTotal.amount * paxCount;
//       baseAmount += currentBase.amount * paxCount;
//       taxAmount += currentTaxes.amount * paxCount;
//       currency = currentTotal.currency;
//     }

//     // Capture Breakdown for Booking
//     paxesList.forEach((p) => {
//       passengerBreakdown.push({
//         type: p["@_Code"],
//         unitPrice: unitPrice,
//         bookingTravelerRef: p["@_BookingTravelerRef"] || "",
//         pricingInfoKey: info["@_Key"], // Needed to link pax to their specific price block
//       });
//     });
//   });

//   // Reconstruct strings for UI components that expect "PKR123" format
//   const totalPriceStr = `${currency}${totalAmount}`;
//   const basePriceStr = `${currency}${baseAmount}`;
//   const taxesStr = `${currency}${taxAmount}`;

//   // ... (Keep existing segments sort and duration logic)
//   segments.sort((a, b) => new Date(a.departure) - new Date(b.departure));
//   const firstSeg = segments[0];
//   const lastSeg = segments[segments.length - 1];
//   const durationMinutes = Math.round(
//     (new Date(lastSeg.arrival) - new Date(firstSeg.departure)) / 60000
//   );

//   const firstFareRef = Array.from(fareInfoRefs)[0];
//   const fareInfo = firstFareRef ? fareInfoMap[firstFareRef] : null;

//   return {
//     id: pricePoint["@_Key"],
//     displayPrice: totalAmount,
//     currency,
//     stops: segments.length - 1,
//     durationMinutes,
//     segments,
//     pricing: {
//       totalPrice: totalPriceStr,
//       basePrice: basePriceStr,
//       taxes: taxesStr,
//       refundable: primaryPricing["@_Refundable"] === "true",
//       changePenalty:
//         primaryPricing["air:ChangePenalty"]?.["air:Amount"] || null,
//       cancelPenalty:
//         primaryPricing["air:CancelPenalty"]?.["air:Amount"] || null,
//     },
//     passengerBreakdown,
//     baggage: fareInfo?.baggage || null,
//     travelportData: {
//       pricePointKey: pricePoint["@_Key"],
//       pricingInfoKey: primaryPricing["@_Key"], // Main key for revalidation
//       totalPrice: totalAmount,
//       basePrice: baseAmount,
//       taxes: taxAmount,
//       currency: currency,
//       passengerTypes: passengerBreakdown,
//       segmentKeys,
//       fareInfoRefs: Array.from(fareInfoRefs),
//       providerCode: primaryPricing["@_ProviderCode"] || "",
//       platingCarrier: primaryPricing["@_PlatingCarrier"] || "",
//       fareCalc:
//         primaryPricing["air:FareCalc"]?.["#text"] ||
//         primaryPricing["air:FareCalc"] ||
//         "",
//     },
//   };
// };

export const processPricePoint = (
  pricePoint,
  segmentMap,
  fareInfoMap,
  amenitiesMap,
  brandMap
) => {
  // 1. NORMALIZE PRICING LIST
  let pricingInfoList =
    pricePoint["air:AirPricingInfo"] || pricePoint.AirPricingInfo;
  if (!pricingInfoList) return null;
  pricingInfoList = Array.isArray(pricingInfoList)
    ? pricingInfoList
    : [pricingInfoList];

  const primaryPricing = pricingInfoList[0];

  // 2. EXTRACT SEGMENTS
  const flightOptions =
    primaryPricing["air:FlightOptionsList"]?.["air:FlightOption"] ||
    primaryPricing.FlightOptionsList?.FlightOption;
  if (!flightOptions) return null;

  const flightOptionsList = Array.isArray(flightOptions)
    ? flightOptions
    : [flightOptions];
  const segments = [];
  const segmentKeys = [];
  const fareInfoRefs = new Set();

  for (const flightOption of flightOptionsList) {
    const optionObj = flightOption["air:Option"] || flightOption.Option;
    const opts = Array.isArray(optionObj) ? optionObj : [optionObj];
    const selectedOption = opts[0];
    if (!selectedOption) continue;

    let bookingInfos =
      selectedOption["air:BookingInfo"] || selectedOption.BookingInfo;
    if (!bookingInfos) continue;
    bookingInfos = Array.isArray(bookingInfos) ? bookingInfos : [bookingInfos];

    for (const booking of bookingInfos) {
      const segKey = booking._SegmentRef || booking["@_SegmentRef"];
      const fareRef = booking._FareInfoRef || booking["@_FareInfoRef"];

      if (segKey && segmentMap[segKey]) {
        segments.push({
          ...segmentMap[segKey],
          bookingCode: booking._BookingCode || booking["@_BookingCode"],
          cabinClass: booking._CabinClass || booking["@_CabinClass"],
          fareInfoRef: fareRef || "",
          segmentKey: segKey,
        });
        segmentKeys.push(segKey);
        if (fareRef) fareInfoRefs.add(fareRef);
      }
    }
  }

  // 3. AGGREGATE MULTI-PASSENGER PRICING
  const grandPriceObj = parsePrice(
    pricePoint._TotalPrice || pricePoint["@_TotalPrice"]
  );
  const grandBaseObj = parsePrice(
    pricePoint._EquivalentBasePrice ||
      pricePoint._BasePrice ||
      pricePoint["@_BasePrice"]
  );
  const grandTaxObj = parsePrice(pricePoint._Taxes || pricePoint["@_Taxes"]);

  let totalAmount = grandPriceObj.amount;
  let baseAmount = grandBaseObj.amount;
  let taxAmount = grandTaxObj.amount;
  let currency = grandPriceObj.currency;

  const passengerBreakdown = [];

  pricingInfoList.forEach((info) => {
    let paxes = info["air:PassengerType"] || info.PassengerType;
    const paxesList = Array.isArray(paxes) ? paxes : [paxes];
    const paxCount = paxesList.length;

    const unitPriceObj = parsePrice(info._TotalPrice || info["@_TotalPrice"]);
    const groupSubtotal = unitPriceObj.amount * paxCount;

    passengerBreakdown.push({
      type: paxesList[0]._Code || paxesList[0]["@_Code"],
      count: paxCount,
      unitPrice: unitPriceObj.amount,
      subtotal: groupSubtotal,
      pricingInfoKey: info._Key || info["@_Key"],
    });
  });

  // 4. SORT SEGMENTS AND CALCULATE METRICS
  segments.sort((a, b) => new Date(a.departure) - new Date(b.departure));

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const durationMinutes = Math.round(
    (new Date(lastSeg.arrival) - new Date(firstSeg.departure)) / 60000
  );

  // ✅ FIX: Get baggage info from the first fare reference
  const firstFareRef = Array.from(fareInfoRefs)[0];
  const fareInfo = firstFareRef ? fareInfoMap[firstFareRef] : null;

  return {
    id: pricePoint._Key || pricePoint["@_Key"],
    displayPrice: totalAmount,
    currency,
    // ✅ FIX: Explicitly adding stops for the UI Filter
    stops: segments.length - 1,
    durationMinutes,
    segments,
    baggage: fareInfo?.baggage || null,
    tripType:
      segments.length > 2
        ? "multi"
        : segments.length === 2
        ? "round"
        : "oneway",
    pricing: {
      totalPrice: `${currency}${totalAmount}`,
      basePrice: `${currency}${baseAmount}`,
      taxes: `${currency}${taxAmount}`,
      refundable:
        (primaryPricing._Refundable || primaryPricing["@_Refundable"]) ===
        "true",
    },
    passengerBreakdown,
    travelportData: {
      pricePointKey: pricePoint._Key || pricePoint["@_Key"],
      pricingInfoKey: primaryPricing._Key || primaryPricing["@_Key"],
      segmentKeys,
      fareInfoRefs: Array.from(fareInfoRefs),
      platingCarrier:
        primaryPricing._PlatingCarrier || primaryPricing["@_PlatingCarrier"],
    },
  };
};

// Parse price string like "PKR65142"
// export const parsePrice = (priceString) => {
//   if (!priceString || typeof priceString !== "string") {
//     return { amount: null, currency: null };
//   }

//   const match = priceString.match(/([A-Z]{3})([0-9.,]+)/);
//   if (!match) return { amount: null, currency: null };

//   return {
//     currency: match[1],
//     amount: parseFloat(match[2].replace(/,/g, "")),
//   };
// };
const parsePrice = (priceStr) => {
  if (!priceStr) return { currency: "PKR", amount: 0 };
  if (typeof priceStr !== "string") return { currency: "PKR", amount: 0 };

  const currency = priceStr.substring(0, 3);
  const amount = parseFloat(priceStr.substring(3));
  return { currency, amount };
};
