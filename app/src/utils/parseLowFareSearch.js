import xml2js from "xml2js";

export const parseLowFareSearch = async (xml) => {
    const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false
    });

    const json = await parser.parseStringPromise(xml);

    const rsp =
        json?.["SOAP:Envelope"]?.["SOAP:Body"]?.["air:LowFareSearchRsp"];

    if (!rsp) return [];

    // lookup tables
    const segments = {};
    const flightDetails = {};

    // AirSegment lookup
    const segList = rsp["air:AirSegmentList"]?.["air:AirSegment"] || [];
    (Array.isArray(segList) ? segList : [segList]).forEach(s => {
        segments[s.$.Key] = s.$;
    });

    // FlightDetails lookup
    const fdList = rsp["air:FlightDetailsList"]?.["air:FlightDetails"] || [];
    (Array.isArray(fdList) ? fdList : [fdList]).forEach(f => {
        flightDetails[f.$.Key] = f.$;
    });

    // MAIN: AirPricingSolution
    const solutions =
        rsp["air:AirPricingSolution"] ||
        rsp["air:AirPricingSolutionList"]?.["air:AirPricingSolution"] ||
        [];

    const results = [];

    (Array.isArray(solutions) ? solutions : [solutions]).forEach(sol => {
        const price = sol.$.TotalPrice;

        const segmentRefs = sol["air:AirSegmentRef"] || [];
        const segRefs = Array.isArray(segmentRefs)
            ? segmentRefs
            : [segmentRefs];

        const itinerary = segRefs.map(ref => {
            const seg = segments[ref.$.Key];
            const fd = flightDetails[seg?.FlightDetailsRef];

            return {
                from: seg.Origin,
                to: seg.Destination,
                carrier: seg.Carrier,
                flightNumber: seg.FlightNumber,
                departure: fd?.DepartureTime,
                arrival: fd?.ArrivalTime,
                aircraft: fd?.Equipment
            };
        });

        results.push({
            price,
            currency: price.substring(0, 3),
            totalSegments: itinerary.length,
            stops: itinerary.length - 1,
            itinerary
        });
    });

    return results;
};
