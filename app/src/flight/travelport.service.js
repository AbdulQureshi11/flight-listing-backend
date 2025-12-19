import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: true
});

export const callTravelport = async (xmlPayload) => {
    const auth = Buffer
        .from(`${process.env.TRAVELPORT_USERNAME}:${process.env.TRAVELPORT_PASSWORD}`)
        .toString("base64");

    const response = await axios.post(
        process.env.TRAVELPORT_ENDPOINT,
        xmlPayload,
        {
            httpsAgent,
            headers: {
                "Content-Type": "text/xml; charset=UTF-8",
                "Authorization": `Basic ${auth}`,
                "Accept": "text/xml",
                "SOAPAction": ""
            },
            timeout: 90000,
            validateStatus: () => true
        }
    );

    return response.data;
};
