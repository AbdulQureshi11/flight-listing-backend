import express from "express";
import { verifyEmailOtp, sendEmailOtp } from "./Email.js";

const router = express.Router();

router.post("/send-otp", sendEmailOtp);
router.post("/verify-otp", verifyEmailOtp);
export default router;
