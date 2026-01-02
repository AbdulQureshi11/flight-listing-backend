import express from "express";
import {
  searchFlights,
  flightDetails,
  validatePassengers,
  validateContactInfo,
  //createReservation,
} from "./flight.controller.js";

const flightrouter = express.Router();

flightrouter.post("/search", searchFlights);
flightrouter.post("/details", flightDetails);
flightrouter.post("/validate-passengers", validatePassengers);
flightrouter.post("/validate-contact", validateContactInfo);
//flightrouter.post("/create-reservation", createReservation);

export default flightrouter;
