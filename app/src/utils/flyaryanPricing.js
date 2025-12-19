import { XMLParser } from "fast-xml-parser";

export const extractCheapestFlights = (xml) => {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
    });

    const json = parser.parse(xml);

    const rsp =
        json["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];

    if (!rsp) return [];

    const segments =
        rsp["air:AirSegmentList"]?.["air:AirSegment"] || [];

    const pricingSolutions =
        rsp["air:AirPricingSolution"] || [];

    const segmentArray = Array.isArray(segments) ? segments : [segments];
    const priceArray = Array.isArray(pricingSolutions)
        ? pricingSolutions
        : [pricingSolutions];

    // 🔑 Map segments by key
    const segmentMap = {};
    segmentArray.forEach(seg => {
        segmentMap[seg.Key] = seg;
    });

    // 🔑 Keep cheapest fare per flight
    const flightMap = {};

    priceArray.forEach(p => {
        const segRef = p["air:AirSegmentRef"]?.Key;
        if (!segRef || !segmentMap[segRef]) return;

        const seg = segmentMap[segRef];

        // ✅ FLYARYAN PRICE FORMULA
        const base = Number(
            p.ApproximateBasePrice?.replace(/[A-Z]/g, "") || 0
        );
        const taxes = Number(
            p.ApproximateTaxes?.replace(/[A-Z]/g, "") || 0
        );

        const finalPrice = base + taxes;

        const flightKey =
            seg.Carrier +
            seg.FlightNumber +
            seg.DepartureTime;

        if (
            !flightMap[flightKey] ||
            flightMap[flightKey].price > finalPrice
        ) {
            flightMap[flightKey] = {
                from: seg.Origin,
                to: seg.Destination,
                departure: seg.DepartureTime,
                arrival: seg.ArrivalTime,
                airline: seg.Carrier,
                flightNumber: seg.FlightNumber,
                aircraft: seg.Equipment,
                price: finalPrice,
                currency: "PKR"
            };
        }
    });

    // ✅ Cheapest first (EXACTLY FlyAryan)
    return Object.values(flightMap).sort(
        (a, b) => a.price - b.price
    );
};
