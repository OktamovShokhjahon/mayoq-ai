import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  logger.info({ uri: env.mongodbUri.replace(/\/\/.*@/, "//***@") }, "Connected to MongoDB");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
