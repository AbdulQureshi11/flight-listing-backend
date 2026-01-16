import { callTravelport } from "../flight/travelport.service.js";
import {
  buildAirPriceXML,
  parseAirPriceResponse,
} from "../utils/AirPriceXml.js";

import fs from "fs";

export const getAirPricing = async (req, res) => {
  try {
    const {
      selectedFlight,
      passengers,
      allFlights = [],
      searchContext,
    } = req.body;

    // 1. Basic Validation
    if (!selectedFlight || !selectedFlight.segments) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const passengerList =
      Array.isArray(passengers) && passengers.length > 0
        ? passengers
        : [{ type: "ADT", quantity: 1 }];

    console.log(`📥 AirPrice Request: Flight ID ${selectedFlight.id}`);

    // 2. Build XML (Including searchContext from your new logic)
    const xmlRequest = buildAirPriceXML(
      selectedFlight,
      passengerList,
      searchContext
    );

    // 3. Call Travelport using your service
    console.log("📤 Sending AirPrice XML via callTravelport...");
    //fs.writeFileSync("AirPriceReq.xml", xmlRequest);
    const xmlResponse = await callTravelport(xmlRequest);
    fs.writeFileSync("AirPriceRsp.xml", xmlResponse);

    // 4. Parse & Handle Errors
    let enrichedFlight;
    try {
      enrichedFlight = await parseAirPriceResponse(xmlResponse, selectedFlight);
    } catch (parseErr) {
      console.error("❌ Parse Error:", parseErr.message);

      const errorMessage = parseErr.message || "";
      // Check for 000276 error code (Segment/Booking Class not available)
      const isAvailabilityError =
        errorMessage.includes("000276") ||
        errorMessage.includes("NOT AVAIL") ||
        errorMessage.includes("BOOKING CLASS");

      if (isAvailabilityError) {
        console.warn("⚠️ 000276 Detected. Finding alternative from pool...");

        const flightPool = Array.isArray(allFlights) ? allFlights : [];

        // Logic to find the cheapest alternative from the current search results
        const alternative = flightPool
          .filter((f) => f.id !== selectedFlight.id)
          .sort((a, b) => (a.displayPrice || 0) - (b.displayPrice || 0))[0];

        return res.status(409).json({
          success: false,
          errorCode: "000276",
          message: "The original booking class is sold out.",
          suggestedFlight: alternative || null,
        });
      }

      // If it's a different parsing/SOAP error, throw to final catch
      throw parseErr;
    }

    // 5. Success - Extract Pricing (Source of Truth logic from New Function)
    const tpData = enrichedFlight.travelportData;
    const pricing = {
      totalPrice: parseFloat(tpData.totalPrice),
      basePrice: parseFloat(tpData.equivalentBasePrice || tpData.basePrice),
      taxes: parseFloat(tpData.taxes),
      currency: tpData.currency,
    };

    console.log(
      `✅ AirPrice Success: ${pricing.totalPrice} ${pricing.currency}`
    );

    // 6. Return enriched flight with updated pricing formatting
    return res.status(200).json({
      success: true,
      flight: {
        ...enrichedFlight,
        displayPrice: pricing.totalPrice, // Sync numeric display price
        pricing: {
          totalPrice: `${pricing.currency}${pricing.totalPrice}`,
          basePrice: `${pricing.currency}${pricing.basePrice}`,
          taxes: `${pricing.currency}${pricing.taxes}`,
          currency: pricing.currency,
        },
      },
      pricing: pricing, // Clean numeric values for the frontend logic
    });
  } catch (err) {
    console.error("❌ AirPrice Final Catch:", err.message);
    return res.status(500).json({
      success: false,
      error: "Pricing failed",
      message: err.message || "Unknown error occurred",
    });
  }
};
