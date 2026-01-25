import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import { buildLowFareSearchXML } from "./lowFareXml.js";
import { callTravelport } from "./travelport.service.js";
import {
  parseXMLToJSON,
  extractAirSegments,
  extractFareInfo,
  extractAmenities,
  extractBrands,
  processPricePoint,
} from "../utils/ParseHelper.js";

export const searchFlights = async (req, res) => {
  try {
    const {
      tripType,
      from,
      to,
      date,
      returnDate,
      segments,
      travelers = { adults: 1, child: 0, infant: 0 },
      travelClass = "Economy",
    } = req.body;

    // ================= 1. VALIDATION =================
    if (!tripType || !["oneway", "round", "multi"].includes(tripType)) {
      return res.status(400).json({ error: "Invalid tripType" });
    }

    // Prepare arguments for the XML Builder
    let builderArgs = {
      adults: travelers.adults,
      children: travelers.child,
      infants: travelers.infant,
      cabinClass: travelClass,
      targetBranch: process.env.TRAVELPORT_TARGET_BRANCH,
    };

    if (tripType === "multi") {
      if (!segments || !Array.isArray(segments) || segments.length < 2) {
        return res
          .status(400)
          .json({ error: "Multi-city requires at least 2 segments" });
      }
      // Pass ONLY the segments array for multi-city
      builderArgs.segments = segments.map((seg) => ({
        from: seg.from.toUpperCase(),
        to: seg.to.toUpperCase(),
        date: seg.date,
      }));
    } else {
      if (!from || !to || !date) {
        return res.status(400).json({ error: "from, to, and date required" });
      }
      // Pass individual fields for oneway/round
      builderArgs.from = from.toUpperCase();
      builderArgs.to = to.toUpperCase();
      builderArgs.departureDate = date; // Match builder's expected key

      if (tripType === "round") {
        if (!returnDate)
          return res.status(400).json({ error: "returnDate required" });
        builderArgs.returnDate = returnDate;
      }
    }

    // ================= 2. SHARED SEARCH & PARSE LOGIC =================
    const processGdsSearch = async (args) => {
      // Call builder with prepared arguments
      const xmlRequest = buildLowFareSearchXML(args);

      const xmlResponse = await callTravelport(xmlRequest);
      fs.writeFileSync("search.xml", xmlResponse);
      if (!xmlResponse) return null;

      const json = parseXMLToJSON(xmlResponse);
      const rsp =
        json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];

      if (!rsp) return null;

      const segmentMap = extractAirSegments(rsp);
      const fareInfoMap = extractFareInfo(rsp);
      const amenitiesMap = extractAmenities(rsp);
      const brandMap = extractBrands(rsp);

      let pricePoints = rsp["air:AirPricePointList"]?.["air:AirPricePoint"];
      if (!pricePoints) return [];

      pricePoints = Array.isArray(pricePoints) ? pricePoints : [pricePoints];

      const flights = pricePoints
        .map((pp) =>
          processPricePoint(
            pp,
            segmentMap,
            fareInfoMap,
            amenitiesMap,
            brandMap,
          ),
        )
        .filter(Boolean);

      return flights.sort((a, b) => a.displayPrice - b.displayPrice);
    };

    // ================= 3. EXECUTION =================
    const flights = await processGdsSearch(builderArgs);

    if (!flights) {
      return res.status(404).json({
        success: false,
        tripType,
        message: "No results or valid response from provider",
      });
    }

    return res.json({
      success: true,
      tripType,
      totalResults: flights.length,
      flights,
      travelers,
      travelClass,
      ...(tripType === "multi" && { segments }),
    });
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({
      error: "Flight search failed",
      message: err.message,
    });
  }
};

const calculateAge = (dob) => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const validatePassengers = async (req, res) => {
  const { passengers } = req.body;
  debugger;
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({
      success: false,
      errors: ["Passengers array required"],
    });
  }

  const errors = [];

  // 1. Infant to Adult Ratio Check
  const adults = passengers.filter((p) => p.type === "ADT").length;
  const infants = passengers.filter((p) => p.type === "INF").length;

  if (infants > adults) {
    errors.push("Each infant must be associated with at least one adult.");
  }

  // 2. Individual Passenger Validation
  passengers.forEach((pax, idx) => {
    const pNum = idx + 1;

    // Existing Field Checks
    if (!pax.firstName) errors.push(`Passenger ${pNum}: first name required`);
    if (!pax.lastName) errors.push(`Passenger ${pNum}: last name required`);
    if (!pax.dob) errors.push(`Passenger ${pNum}: date of birth required`);
    if (!pax.passportNumber)
      errors.push(`Passenger ${pNum}: passport number required`);
    if (!pax.nationality)
      errors.push(`Passenger ${pNum}: nationality required`);

    // --- NEW: Age Validation Logic ---
    if (pax.dob) {
      const age = calculateAge(pax.dob);

      if (pax.type === "ADT" && age < 12) {
        errors.push(`Passenger ${pNum}: Must be an Adult)`);
      } else if (pax.type === "CNN" && (age < 2 || age >= 12)) {
        errors.push(`Passenger ${pNum}: Must be a Child)`);
      } else if (pax.type === "INF" && age >= 2) {
        errors.push(
          `Passenger ${pNum}: Must be under 2 years old to be an Infant)`,
        );
      }
    }
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
