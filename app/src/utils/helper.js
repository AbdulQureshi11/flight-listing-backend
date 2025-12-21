// src/utils/helper.js

/* 🔹 Extract ALL AirSegments from response (any structure) */
export const extractAirSegments = (rsp) => {
  let segments = [];

  if (rsp["air:AirSegment"]) {
    segments = rsp["air:AirSegment"];
  } else if (rsp["air:AirItinerary"]?.["air:AirSegment"]) {
    segments = rsp["air:AirItinerary"]["air:AirSegment"];
  } else if (rsp["air:AirSegmentList"]?.["air:AirSegment"]) {
    segments = rsp["air:AirSegmentList"]["air:AirSegment"];
  }

  const arr = Array.isArray(segments) ? segments : [segments];

  const map = {};
  for (const seg of arr) {
    if (!seg?.Key) continue;

    map[seg.Key] = {
      Key: seg.Key, // ✅ CRITICAL FIX
      carrier: seg.Carrier,
      flightNumber: seg.FlightNumber,
      from: seg.Origin,
      to: seg.Destination,
      departure: seg.DepartureTime,
      arrival: seg.ArrivalTime,
      equipment: seg.Equipment, // ✅ BONUS: Include equipment
      distance: seg.Distance || "0", // ✅ BONUS: Include distance
      providerCode: seg.ProviderCode, // ✅ BONUS: Include provider
    };
  }

  return map;
};

/* 🔹 Extract segment refs from ANY Journey structure */
export const extractSegmentRefs = (pricingSolution) => {
  let refs = [];

  const journeys = pricingSolution["air:Journey"];

  if (Array.isArray(journeys)) {
    for (const j of journeys) {
      const r = j["air:AirSegmentRef"];
      if (Array.isArray(r)) refs.push(...r);
      else if (r) refs.push(r);
    }
  } else if (journeys?.["air:AirSegmentRef"]) {
    const r = journeys["air:AirSegmentRef"];
    refs = Array.isArray(r) ? r : [r];
  }

  return refs;
};

/* 🔹 Duration helper */
export const minutesBetween = (start, end) =>
  Math.round((new Date(end) - new Date(start)) / 60000);
