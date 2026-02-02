import express from "express";
import {
  searchFlights,
  validatePassengers,
  validateContactInfo,
  searchAirports,
} from "./flight.controller.js";


const flightrouter = express.Router();

flightrouter.post("/search", searchFlights);
flightrouter.post("/validate-passengers", validatePassengers);
flightrouter.post("/validate-contact", validateContactInfo);

flightrouter.get("/airports", searchAirports);

export default flightrouter;
