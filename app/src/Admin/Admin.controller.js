// controllers/admin.controller.js
import Booking from "../Model/Booking.js";
//import { createReservation } from "./../flight/flight.controller.js";

// Approve booking - only change status
export const approveBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { adminNotes } = req.body;

    // Find the booking
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        error: `Booking is already ${booking.status}`,
      });
    }

    // Update status to approved
    booking.status = "approved";
    booking.approvedAt = new Date();
    booking.adminNotes = adminNotes || booking.adminNotes;
    await booking.save();

    return res.json({
      success: true,
      message: "Booking status updated to approved",
      booking: {
        bookingId: booking.bookingId,
        status: booking.status,
        adminNotes: booking.adminNotes,
        approvedAt: booking.approvedAt,
      },
    });
  } catch (err) {
    console.error("❌ Approval Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rejectionReason } = req.body;

    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        error: `Booking is already ${booking.status}`,
      });
    }

    booking.status = "rejected";
    booking.rejectionReason = rejectionReason;
    await booking.save();

    return res.json({
      success: true,
      message: "Booking rejected",
      booking: {
        bookingId: booking.bookingId,
        status: booking.status,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
