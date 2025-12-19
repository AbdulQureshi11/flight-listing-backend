import { XMLParser } from "fast-xml-parser";
import { buildLowFareSearchXML } from "./lowFareXml.js";
import { callTravelport } from "./travelport.service.js";
import {
    extractAirSegments,
    extractSegmentRefs,
    minutesBetween
} from "../utils/helper.js";

export const searchFlights = async (req, res) => {
    try {
        const { from, to, date, adults = 1 } = req.body;

        if (!from || !to || !date) {
            return res.status(400).json({ error: "from, to, date required" });
        }

        /* ===== Build XML ===== */
        const xmlRequest = buildLowFareSearchXML({
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            date,
            adults,
            targetBranch: process.env.TRAVELPORT_TARGET_BRANCH
        });

        /* ===== Call Travelport ===== */
        const xmlResponse = await callTravelport(xmlRequest);

        /* ===== Parse XML ===== */
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ""
        });

        const json = parser.parse(xmlResponse);
        const rsp =
            json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];

        if (!rsp) {
            return res.json({ success: true, flights: [] });
        }

        /* ===== Extract ALL segments safely ===== */
        const segmentMap = extractAirSegments(rsp);

        if (!Object.keys(segmentMap).length) {
            console.log("❌ No AirSegments found in response");
            return res.json({ success: true, flights: [] });
        }

        /* ===== Pricing solutions ===== */
        const rawSolutions = rsp["air:AirPricingSolution"];
        if (!rawSolutions) {
            return res.json({ success: true, flights: [] });
        }

        const solutions = Array.isArray(rawSolutions)
            ? rawSolutions
            : [rawSolutions];

        const uniqueFlights = new Map();

        for (const sol of solutions) {
            const price = Number(sol.TotalPrice?.replace(/[^\d]/g, ""));
            const currency = sol.TotalPrice?.replace(/[0-9.]/g, "");

            const refs = extractSegmentRefs(sol);
            if (!refs.length) continue;

            const segments = refs
                .map(r => segmentMap[r.Key])
                .filter(Boolean);

            if (!segments.length) continue;

            const uniqueKey = segments
                .map(s => `${s.carrier}${s.flightNumber}${s.departure}`)
                .join("-");

            const durationMinutes = minutesBetween(
                segments[0].departure,
                segments[segments.length - 1].arrival
            );

            const flight = {
                price,
                currency,
                stops: segments.length - 1,
                durationMinutes,
                segments
            };

            if (
                !uniqueFlights.has(uniqueKey) ||
                price < uniqueFlights.get(uniqueKey).price
            ) {
                uniqueFlights.set(uniqueKey, flight);
            }
        }

        return res.json({
            success: true,
            flights: Array.from(uniqueFlights.values()).sort(
                (a, b) => a.price - b.price
            )
        });

    } catch (err) {
        console.error("❌ Flight Search Error:", err);
        return res.status(500).json({ error: "Flight search failed" });
    }
};
