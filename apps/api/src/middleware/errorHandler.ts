import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { errorCodeFor } from "./error-codes";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found", code: "notFound" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", code: "validationFailed", details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    // The code is what the console translates; the message is its fallback.
    res.status(err.status).json({ error: err.message, code: errorCodeFor(err.message), details: err.details });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error", code: "internal" });
}
