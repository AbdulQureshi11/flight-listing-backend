// routes/booking.routes.js
import express from "express";
import {
  createInternalBooking,
  getBooking,
  getAllPendingBookings,
} from "../Booking/Booking.Controller.js";

const router = express.Router();

// Customer routes
router.post("/bookings", createInternalBooking);
router.get("/bookings/:bookingId", getBooking);

// Admin routes (add authentication middleware)
router.get("/admin/bookings/pending", getAllPendingBookings);

export default router;
