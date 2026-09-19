import { createApp } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, "TwinRx API listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start TwinRx API");
  process.exit(1);
});
