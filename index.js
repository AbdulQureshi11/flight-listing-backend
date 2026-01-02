import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import flightrouter from "./app/src/flight/flight.routes.js";
import { connectDB } from "./app/src/config/mongodb.js";
import bookingrouter from "./app/src/Booking/Booking.Route.js";
import adminrouter from "./app/src/Admin/Admin.Route.js";
import emailrouter from "./app/src/EmailVerfication/EmailRoute.js";

// Connect to MongoDB
connectDB();

const app = express();

const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", flightrouter);
app.use("/api", bookingrouter);
app.use("/api", adminrouter);
app.use("/api", emailrouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log("ENV CHECK:", {
    BRANCH: process.env.TRAVELPORT_TARGET_BRANCH,
    USERNAME: process.env.TRAVELPORT_USERNAME ? "✅ loaded" : "❌ missing",
    PASSWORD: process.env.TRAVELPORT_PASSWORD ? "✅ loaded" : "❌ missing",
    ENDPOINT: process.env.TRAVELPORT_ENDPOINT,
  });
});
