// controllers/booking.controller.js
import Booking from "../Model/Booking.js";
import { nanoid } from "nanoid";

export const createInternalBooking = async (req, res) => {
  try {
    const {
      flight,
      pricingSolution,
      itinerary,
      passengers,
      contactInfo,
      formOfPayment,
    } = req.body;

    // Validate required fields
    if (
      !flight ||
      !pricingSolution ||
      !itinerary ||
      !passengers?.length ||
      !contactInfo
    ) {
      return res
        .status(400)
        .json({ error: "Missing required booking information" });
    }

    // Create internal booking record
    const booking = new Booking({
      bookingId: `BK${nanoid(10)}`,
      flight: flight || null,
      pricingSolution,
      itinerary,
      passengers,
      contactInfo,
      formOfPayment: formOfPayment || { type: "Cash" },
      status: "pending",
    });

    await booking.save();

    return res.json({
      success: true,
      bookingId: booking.bookingId,
      message: "Booking submitted successfully. Waiting for approval.",
      booking: {
        bookingId: booking.bookingId,
        status: booking.status,
        createdAt: booking.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Internal Booking Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json({ success: true, booking });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getAllPendingBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ status: "pending" }).sort({
      createdAt: -1,
    });

    return res.json({ success: true, bookings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
