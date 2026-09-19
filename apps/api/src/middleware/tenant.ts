import type { NextFunction, Request, Response } from "express";

/**
 * Strips any client-supplied tenantId from the request body/query so that
 * handlers can never be tricked into acting on another tenant's data.
 * The authoritative tenantId always comes from req.auth (set by requireAuth).
 */
export function stripClientTenantId(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object" && "tenantId" in req.body) {
    delete (req.body as Record<string, unknown>).tenantId;
  }
  if (req.query && typeof req.query === "object" && "tenantId" in req.query) {
    delete (req.query as Record<string, unknown>).tenantId;
  }
  next();
}
