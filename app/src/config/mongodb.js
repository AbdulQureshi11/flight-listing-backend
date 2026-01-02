import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/travelapp";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};
