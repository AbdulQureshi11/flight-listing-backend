// routes/booking.routes.js
import express from "express";
import {
  createBooking,
  validatePassengers,
} from "../Booking/Booking.Controller.js";
//import { sendOtp, verifyOtp } from "./Otp.Controller.js";
import { getAirPricing } from "./AirPrice.Controller.js";

const router = express.Router();

router.post("/air-pricing", getAirPricing);
router.post("/bookings", createBooking);
router.post("/validate-passengers", validatePassengers);
//router.post("/send-otp", sendOtp);
//router.post("/verify-otp", verifyOtp);
// Admin routes (add authentication middleware)
//router.get("/admin/bookings/pending", getAllPendingBookings);

export default router;
