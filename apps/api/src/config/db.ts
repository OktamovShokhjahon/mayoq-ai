import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

/**
 * What the connection string points at, with the password dropped.
 *
 * Built from parsed URL parts rather than by masking the original string, so
 * the password is never in the output even if the URL is malformed in a way a
 * regex would not anticipate.
 *
 * This exists because "bad auth : authentication failed" says nothing about
 * which credential was rejected. A typo in the username, a connection string
 * with no database name, or a user created against a non-default auth database
 * all produce the same sentence, and telling them apart otherwise means
 * reading an environment variable you cannot print.
 */
export function describeTarget(uri: string): Record<string, string> {
  try {
    const url = new URL(uri);
    const database = url.pathname.replace(/^\//, "");
    return {
      host: url.hostname,
      user: url.username ? decodeURIComponent(url.username) : "(none)",
      // No database name means Mongo silently uses "test": the app then
      // connects, reads nothing, and looks broken rather than misconfigured.
      database: database || "(none — defaults to 'test')",
      authSource: url.searchParams.get("authSource") ?? "admin (default)",
    };
  } catch {
    return { uri: "(unparseable MONGODB_URI)" };
  }
}

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  const target = describeTarget(env.mongodbUri);

  try {
    await mongoose.connect(env.mongodbUri);
  } catch (err) {
    const authFailed =
      err instanceof Error && /bad auth|authentication failed/i.test(err.message);
    logger.error(
      {
        ...target,
        hint: authFailed
          ? "Atlas rejected these credentials. Check the user exists under Database Access with this exact spelling, reset its password, and percent-encode any of @ : / ? # [ ] % in the password. An IP that is not allow-listed fails as a timeout, not as bad auth."
          : "Could not reach the database. Check Network Access allows this host's IP.",
      },
      "MongoDB connection failed",
    );
    throw err;
  }

  logger.info(target, "Connected to MongoDB");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
