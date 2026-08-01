import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Mongoose buffers queries issued before the connection is ready, which turns a
 * bad connection string into a silent 10-second hang instead of an error. We
 * disable that and fail fast at boot instead.
 */
mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", true);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("connected", () => {
    console.log(`[db] connected to ${mongoose.connection.name}`);
  });
  mongoose.connection.on("error", (error) => {
    console.error("[db] connection error:", error);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
