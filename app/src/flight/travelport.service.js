import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: true,
});

// export const callTravelport = async (xmlPayload) => {
//   const auth = Buffer.from(
//     `${process.env.TRAVELPORT_USERNAME}:${process.env.TRAVELPORT_PASSWORD}`
//   ).toString("base64");

//   const response = await axios.post(
//     process.env.TRAVELPORT_ENDPOINT,
//     xmlPayload,
//     {
//       headers: {
//         "Content-Type": "text/xml; charset=UTF-8",
//         Authorization: `Basic ${auth}`,
//         Accept: "text/xml",
//       },
//       timeout: 90000,
//       validateStatus: () => true,
//     }
//   );

//   return response.data;
// };
// REPLACE the entire callTravelport function with this:

export const callTravelport = async (xmlPayload, maxRetries = 3) => {
  const auth = Buffer.from(
    `${process.env.TRAVELPORT_USERNAME}:${process.env.TRAVELPORT_PASSWORD}`
  ).toString("base64");

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Travelport API Attempt ${attempt}/${maxRetries}`);

      const response = await axios.post(
        process.env.TRAVELPORT_ENDPOINT,
        xmlPayload,
        {
          headers: {
            "Content-Type": "text/xml; charset=UTF-8",
            Authorization: `Basic ${auth}`,
            Accept: "text/xml",
          },
          httpsAgent,
          timeout: 90000,
          validateStatus: () => true,
        }
      );

      // Check if response contains "Provider transaction failed"
      const isProviderError =
        response.data?.includes?.("Provider transaction failed") ||
        response.data?.includes?.("faultstring");

      if (isProviderError && attempt < maxRetries) {
        const errorMsg =
          response.data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] ||
          "Unknown error";
        console.warn(`⚠️ Attempt ${attempt} failed: ${errorMsg}. Retrying...`);

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // Success or final attempt
      return response.data;
    } catch (err) {
      lastError = err;

      // Retry on network/timeout errors
      const isRetriable =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.message?.includes("timeout");

      if (isRetriable && attempt < maxRetries) {
        console.warn(
          `⚠️ Network error on attempt ${attempt}: ${err.message}. Retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("All retry attempts failed");
};
