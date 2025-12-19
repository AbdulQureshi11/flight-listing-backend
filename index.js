import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import flightrouter from "./app/src/flight/flight.routes.js";

const app = express();

const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", flightrouter);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log("ENV CHECK:", {
        BRANCH: process.env.TRAVELPORT_TARGET_BRANCH,
        USERNAME: process.env.TRAVELPORT_USERNAME ? "✅ loaded" : "❌ missing",
        PASSWORD: process.env.TRAVELPORT_PASSWORD ? "✅ loaded" : "❌ missing",
        ENDPOINT: process.env.TRAVELPORT_ENDPOINT

    });
});
