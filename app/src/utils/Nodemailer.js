import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify connection
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email configuration error:", error.message);
  } else {
    console.log("✅ Email server is ready");
  }
});

/**
 * Generic function to send emails
 */
export const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: {
      name: "Flight Booking",
      address: process.env.EMAIL_USER,
    },
    to,
    subject,
    html,
  };

  try {
    const info = transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("❌ Nodemailer Error:", error);
    throw error;
  }
};
