import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";


export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI
    await mongoose.connect(mongoURI as string);
    console.log("Database Connected Successfully");
  } catch (error) {
    console.error("Connection error: ", error);
    process.exit(1);
  }
};

export default connectDB;
