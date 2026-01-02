import express from "express";
import { approveBooking, rejectBooking } from "./Admin.controller.js";

const router = express.Router();
router.post("/admin/bookings/:bookingId/approve", approveBooking);
router.post("/admin/bookings/:bookingId/reject", rejectBooking);

export default router;
