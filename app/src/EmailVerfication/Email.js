import EmailVerification from "../Model/EmailVerfication.js";
import crypto from "crypto";

export const sendEmailOtp = async (req, res) => {
  const { email } = req.body;

  const otp = crypto.randomInt(100000, 999999).toString();

  await EmailVerification.findOneAndUpdate(
    { email },
    {
      otp,
      verified: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    { upsert: true, new: true }
  );

  // send email here

  res.json({ success: true, message: "OTP sent" });
};

export const verifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await EmailVerification.findOne({ email });

  if (!record) {
    return res.status(400).json({ error: "OTP not found" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  record.verified = true;
  await record.save();

  res.json({ success: true, message: "Email verified" });
};
