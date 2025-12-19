import express from "express";
import { searchFlights } from "./flight.controller.js";

const flightrouter = express.Router();

flightrouter.post("/search", searchFlights);

export default flightrouter;