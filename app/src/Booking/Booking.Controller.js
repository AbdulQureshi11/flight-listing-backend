import fs from "fs";
import { buildAirCreateReservationXML } from "./../utils/ReservationXml.js";
import { callTravelport } from "./../flight/travelport.service.js";
import parseBookingResponse from "./../utils/ReservationRspParser.js"; // Import the new parser
import { sendEmail } from "../utils/Nodemailer.js";
import { getBookingTemplate } from "../utils/EmailTemplate.js";
// ==================== CREATE BOOKING ====================
export const createBooking = async (req, res) => {
  try {
    const { selectedFlight, passengers, contactInfo, formOfPayment } = req.body;

    console.log("🟢 Incoming Booking Request:", {
      selectedFlight,
      passengers,
      contactInfo,
      formOfPayment,
    });

    // ================= VALIDATION =================
    if (
      !selectedFlight ||
      !selectedFlight.travelportData ||
      !passengers ||
      !contactInfo
    ) {
      console.error("❌ Missing required fields");
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "selectedFlight.travelportData",
          "passengers",
          "contactInfo",
        ],
      });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      console.error("❌ No passengers provided");
      return res.status(400).json({ error: "At least one passenger required" });
    }

    // Infant validation
    const adults = passengers.filter((p) => p.type === "ADT").length;
    const infants = passengers.filter((p) => p.type === "INF").length;
    if (infants > adults) {
      console.error("❌ Infant count exceeds adults");
      return res
        .status(400)
        .json({ error: "Each infant must be associated with one adult" });
    }

    // Validate passenger fields
    passengers.forEach((p, idx) => {
      if (!p.firstName || !p.lastName || !p.type) {
        console.error(`❌ Passenger ${idx + 1} missing required fields`);
        throw new Error(
          `Passenger ${idx + 1}: firstName, lastName, and type are required`
        );
      }
    });

    // Validate contact info
    if (!contactInfo.email || !contactInfo.phone) {
      console.error("❌ Contact info missing email or phone");
      return res.status(400).json({ error: "Email and phone number required" });
    }

    // ================= BUILD XML =================
    const xmlRequest = buildAirCreateReservationXML(
      selectedFlight,
      passengers,
      contactInfo,
      formOfPayment
    );
    fs.writeFileSync("./debug_air_create_request.xml", xmlRequest, "utf8");

    // ================= CALL TRAVELPORT =================
    const xmlResponse = await callTravelport(xmlRequest);

    // Save response for debugging
    fs.writeFileSync("./debug_air_create_response.xml", xmlResponse, "utf8");

    if (!xmlResponse) {
      console.error("❌ No response from Travelport");
      return res.status(500).json({ error: "No response from Travelport" });
    }

    // ================= PARSE RESPONSE WITH NEW PARSER =================
    const parsedData = await parseBookingResponse(xmlResponse);

    // ================= SEND EMAIL NOTIFICATION =================
    try {
      const emailData = {
        pnr: parsedData.booking.pnr,
        passengers: parsedData.booking.passengers,
        totalPrice: parsedData.booking.pricing?.totalPrice || "N/A",
      };

      const emailHtml = getBookingTemplate(emailData);

      await sendEmail({
        to: contactInfo.email,
        subject: `Booking Confirmation - PNR: ${parsedData.booking.pnr}`,
        html: emailHtml,
      });

      console.log(`✅ Confirmation email sent to: ${contactInfo.email}`);
    } catch (emailError) {
      console.error("⚠️ Email failed to send:", emailError.message);
    }

    // ================= SUCCESS RESPONSE =================
    return res.json({
      success: true,
      bookingId: parsedData.booking.bookingId,
      pnr: parsedData.booking.pnr,
      airlineConfirmation: parsedData.booking.airlineConfirmation,
      message: "Booking submitted successfully. Awaiting approval.",
      status: parsedData.booking.status,
      ticketingDeadline: parsedData.booking.ticketingDeadline,
      details: {
        passengers: parsedData.booking.passengers.length,
        email: contactInfo.email,
        segments: parsedData.booking.segments.length,
        totalPrice: parsedData.booking.pricing?.totalPrice,
        warnings: parsedData.booking.warnings,
      },
    });
  } catch (err) {
    console.error("❌ Booking error:", err);
    return res
      .status(500)
      .json({ error: "Booking failed", message: err.message });
  }
};

// ==================== VALIDATE PASSENGERS ====================
export const validatePassengers = async (req, res) => {
  try {
    const { passengers } = req.body;

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({
        errors: ["At least one passenger required"],
      });
    }

    const errors = [];

    passengers.forEach((p, idx) => {
      // Required fields
      if (!p.firstName)
        errors.push(`Passenger ${idx + 1}: First name required`);
      if (!p.lastName) errors.push(`Passenger ${idx + 1}: Last name required`);
      if (!p.type) errors.push(`Passenger ${idx + 1}: Passenger type required`);
      if (!p.gender) errors.push(`Passenger ${idx + 1}: Gender required`);
      if (!p.dob) errors.push(`Passenger ${idx + 1}: Date of birth required`);

      // Validate DOB format
      if (p.dob && !/^\d{4}-\d{2}-\d{2}$/.test(p.dob)) {
        errors.push(
          `Passenger ${idx + 1}: Invalid date format (use YYYY-MM-DD)`
        );
      }

      // Validate age based on type
      if (p.dob && p.type) {
        const age = calculateAge(p.dob);
        if (p.type === "ADT" && age < 12) {
          errors.push(
            `Passenger ${idx + 1}: Adults must be 12+ years old (found ${age})`
          );
        }
        if (p.type === "CNN" && (age < 2 || age >= 12)) {
          errors.push(
            `Passenger ${
              idx + 1
            }: Children must be 2-11 years old (found ${age})`
          );
        }
        if (p.type === "INF" && age >= 2) {
          errors.push(
            `Passenger ${
              idx + 1
            }: Infants must be under 2 years old (found ${age})`
          );
        }
      }

      // Passport validation (if international)
      if (p.passportNumber) {
        if (!p.nationality)
          errors.push(
            `Passenger ${idx + 1}: Nationality required with passport`
          );
        if (!p.passportExpiry)
          errors.push(`Passenger ${idx + 1}: Passport expiry required`);

        // Check passport not expired
        if (p.passportExpiry) {
          const expiry = new Date(p.passportExpiry);
          const today = new Date();
          if (expiry < today) {
            errors.push(`Passenger ${idx + 1}: Passport has expired`);
          }
        }
      }
    });

    // Infant rule
    const adults = passengers.filter((p) => p.type === "ADT").length;
    const infants = passengers.filter((p) => p.type === "INF").length;
    if (infants > adults) {
      errors.push("Each infant must be associated with one adult");
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    return res.json({ valid: true, message: "All passengers valid" });
  } catch (err) {
    console.error("❌ Validation error:", err);
    return res.status(500).json({ errors: [err.message] });
  }
};

// ==================== HELPER FUNCTIONS ====================
const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};
