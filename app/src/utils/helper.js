// src/utils/helper.js

/* 🔹 Extract ALL AirSegments from response */
export const extractAirSegments = (rsp) => {
  let segments = [];

  // Check all possible locations (with namespace prefixes)
  if (rsp["air:AirSegmentList"]?.["air:AirSegment"]) {
    segments = rsp["air:AirSegmentList"]["air:AirSegment"];
  } else if (rsp.AirSegmentList?.AirSegment) {
    segments = rsp.AirSegmentList.AirSegment;
  } else if (rsp.AirSegment) {
    segments = rsp.AirSegment;
  } else if (rsp.AirItinerary?.AirSegment) {
    segments = rsp.AirItinerary.AirSegment;
  } else if (rsp["air:FlightDetailsList"]?.["air:FlightDetails"]) {
    segments = rsp["air:FlightDetailsList"]["air:FlightDetails"];
  } else if (rsp.FlightDetailsList?.FlightDetails) {
    segments = rsp.FlightDetailsList.FlightDetails;
  }

  const arr = Array.isArray(segments) ? segments : [segments];

  const map = {};
  for (const seg of arr) {
    if (!seg?.Key) continue;

    map[seg.Key] = {
      Key: seg.Key,
      carrier: seg.Carrier || "",
      flightNumber: seg.FlightNumber || "",
      from: seg.Origin,
      to: seg.Destination,
      departure: seg.DepartureTime,
      arrival: seg.ArrivalTime,
      equipment: seg.Equipment || "",
      distance: seg.Distance || "0",
      providerCode: seg.ProviderCode || "",
      cabinClass: seg.CabinClass || "",
      bookingCode: seg.BookingCode || "",
    };
  }

  return map;
};

/* 🔹 Extract segment refs from pricing solution */
export const extractSegmentRefs = (pricingSolution) => {
  let refs = [];

  // Check AirPricingInfo first
  const pricingInfo = pricingSolution["air:AirPricingInfo"];

  if (pricingInfo) {
    const flightOptions =
      pricingInfo["air:FlightOptionsList"]?.["air:FlightOption"];

    if (flightOptions) {
      const optionsArray = Array.isArray(flightOptions)
        ? flightOptions
        : [flightOptions];

      for (const option of optionsArray) {
        const optionDetails = option["air:Option"];
        const optArray = Array.isArray(optionDetails)
          ? optionDetails
          : [optionDetails];

        for (const opt of optArray) {
          const bookingInfo = opt["air:BookingInfo"];
          const bookingArray = Array.isArray(bookingInfo)
            ? bookingInfo
            : [bookingInfo];

          for (const booking of bookingArray) {
            if (booking?.SegmentRef) {
              refs.push({ Key: booking.SegmentRef });
            }
          }
        }
      }
    }
  }

  // Fallback: check Journey structure
  if (refs.length === 0) {
    const journeys = pricingSolution.Journey || pricingSolution["air:Journey"];

    if (Array.isArray(journeys)) {
      for (const j of journeys) {
        const r = j.AirSegmentRef || j["air:AirSegmentRef"];
        if (Array.isArray(r)) refs.push(...r);
        else if (r) refs.push(r);
      }
    } else if (journeys?.AirSegmentRef || journeys?.["air:AirSegmentRef"]) {
      const r = journeys.AirSegmentRef || journeys["air:AirSegmentRef"];
      refs = Array.isArray(r) ? r : [r];
    } else if (
      pricingSolution.AirSegmentRef ||
      pricingSolution["air:AirSegmentRef"]
    ) {
      const r =
        pricingSolution.AirSegmentRef || pricingSolution["air:AirSegmentRef"];
      refs = Array.isArray(r) ? r : [r];
    }
  }

  return refs;
};

/* 🔹 Duration helper */
export const minutesBetween = (start, end) => {
  try {
    const diff = Math.round((new Date(end) - new Date(start)) / 60000);
    return diff > 0 ? diff : 0;
  } catch (error) {
    console.error("Error calculating duration:", error);
    return 0;
  }
};

/* 🔹 Format currency amount */
export const formatCurrency = (amount, currency = "PKR") => {
  if (!amount) return "N/A";
  return `${currency} ${Number(amount).toLocaleString()}`;
};

/* 🔹 Format duration to human readable */
export const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

/* 🔹 Parse price from string like "AUD353.90" or "PKR65142" */
export const parsePrice = (priceString) => {
  if (!priceString || typeof priceString !== "string") {
    return { amount: null, currency: null };
  }

  const match = priceString.match(/([A-Z]{3})([0-9.,]+)/);

  if (!match) {
    return { amount: null, currency: null };
  }

  return {
    currency: match[1],
    amount: Number(match[2].replace(/,/g, "")),
  };
};