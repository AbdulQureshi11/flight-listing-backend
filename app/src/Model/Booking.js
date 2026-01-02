import mongoose from "mongoose";

const passengerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    type: { type: String, required: true },
    gender: { type: String, required: true },
    dob: String,
    email: String,
    phone: String,
    phoneCountryCode: String,
  },
  { _id: false }
); // Don't create _id for subdocuments

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, required: true },
    userId: String,

    flight: {
      segments: [mongoose.Schema.Types.Mixed],
      price: Number,
      currency: String,
    },

    pricingSolution: mongoose.Schema.Types.Mixed,
    itinerary: mongoose.Schema.Types.Mixed,

    passengers: [passengerSchema], // ✅ Use the schema, not inline definition

    contactInfo: {
      email: { type: String, required: true },
      phone: { type: String, required: true },
      phoneCountryCode: { type: String, required: true },
    },

    formOfPayment: {
      type: { type: String, default: "Cash" }, // Nested 'type' field
      cardType: String,
      lastFourDigits: String,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "confirmed", "cancelled"],
      default: "pending",
    },

    pnr: String,
    airlinePNR: String,
    travelportResponse: mongoose.Schema.Types.Mixed,

    approvedAt: Date,
    confirmedAt: Date,
    adminNotes: String,
    rejectionReason: String,
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
