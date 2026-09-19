import type { NextFunction, Request, Response } from "express";
import type { Role } from "../shared/types";

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({ error: "Insufficient role for this action" });
      return;
    }
    next();
  };
}
