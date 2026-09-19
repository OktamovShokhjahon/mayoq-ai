import pino from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "passwordHash",
  "req.body.password",
  "*.ssn",
  "*.dateOfBirth",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
});
