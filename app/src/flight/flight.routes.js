import express from "express";
import {
  searchFlights,
  validatePassengers,
  validateContactInfo,
} from "./flight.controller.js";

const flightrouter = express.Router();

flightrouter.post("/search", searchFlights);
flightrouter.post("/validate-passengers", validatePassengers);
flightrouter.post("/validate-contact", validateContactInfo);

export default flightrouter;
