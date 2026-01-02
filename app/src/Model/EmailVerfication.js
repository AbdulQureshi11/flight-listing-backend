import mongoose from "mongoose";

const emailVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },

    otp: {
      type: String,
      required: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Mongo auto-delete
    },
  },
  { timestamps: true }
);

export default mongoose.model("EmailVerification", emailVerificationSchema);
