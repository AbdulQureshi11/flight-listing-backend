import express from "express";
import { searchFlights, flightDetails } from "./flight.controller.js";

const flightrouter = express.Router();

flightrouter.post("/search", searchFlights);
flightrouter.post("/details", flightDetails);

export default flightrouter;
