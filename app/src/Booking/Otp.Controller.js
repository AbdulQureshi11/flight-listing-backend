import { sendEmail } from "../utils/Nodemailer.js";
import { getOtpTemplate } from "../utils/emailTemplates.js";

// Inside sendOtp function:
await sendEmail({
  to: email,
  subject: "Your Verification Code",
  html: getOtpTemplate(otp),
});
