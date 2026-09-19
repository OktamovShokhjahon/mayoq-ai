import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../modules/users/user.model";
import type { JwtAccessPayload, Role } from "../shared/types";

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  tokenVersion: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as JwtAccessPayload;
    const user = await User.findById(payload.sub).select("tenantId role status tokenVersion").lean();

    const isActiveStatus = user?.status === "active" || user?.status === "must_change_password";
    if (!user || !isActiveStatus) {
      res.status(401).json({ error: "Account is inactive" });
      return;
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ error: "Token has been revoked" });
      return;
    }
    if (String(user.tenantId) !== payload.tenantId) {
      res.status(401).json({ error: "Tenant mismatch" });
      return;
    }

    req.auth = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
