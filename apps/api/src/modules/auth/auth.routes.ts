import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../middleware/auth";
import { recordAuditEvent } from "../audit/audit.service";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerClinicSchema,
} from "./auth.validation";
import { changePassword, login, refreshAccessToken, registerClinic, revokeAllSessions } from "./auth.service";

export const authRouter = Router();

/**
 * Brute-force protection for the credential endpoints. Only *failed* attempts
 * count: a clinic demoing on one shared IP, or a doctor signing in on a second
 * device, was previously spending the same budget as an attacker and getting
 * locked out of a working password.
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // The client reads `error` off a JSON body. The limiter's default plain-text
  // reply parsed as nothing, so a throttled sign-in surfaced to the clinician
  // as "Request failed" with no hint that waiting would fix it.
  message: { error: "Too many sign-in attempts. Try again in a few minutes." },
});

/**
 * Refreshing is not a credential guess, so it gets its own budget. Sharing the
 * login limiter meant a long session could exhaust it and then be unable to
 * sign back in — the lockout looked exactly like a broken login page.
 */
const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Session refresh is temporarily throttled. Try again shortly." },
});

authRouter.post("/register-clinic", authRateLimit, async (req, res, next) => {
  try {
    const input = registerClinicSchema.parse(req.body);
    const { tenant, admin, subscription } = await registerClinic(input);
    await recordAuditEvent({
      tenantId: String(tenant._id),
      actorId: String(admin._id),
      actorRole: "ADMIN",
      action: "clinic.register",
      targetType: "Tenant",
      targetId: String(tenant._id),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.status(201).json({
      tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug, trialEndsAt: tenant.trialEndsAt },
      admin: { id: admin._id, email: admin.email, fullName: admin.fullName },
      subscription: { plan: subscription.plan, state: subscription.state, trialEndsAt: subscription.trialEndsAt },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await login(input.email, input.password, input.tenantSlug);
    await recordAuditEvent({
      tenantId: String(user.tenantId),
      actorId: String(user._id),
      actorRole: user.role,
      action: "auth.login",
      targetType: "User",
      targetId: String(user._id),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        mustChangePassword: user.status === "must_change_password",
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", refreshRateLimit, async (req, res, next) => {
  try {
    const input = refreshSchema.parse(req.body);
    const tokens = await refreshAccessToken(input.refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await revokeAllSessions(req.auth!.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post("/forgot-password", authRateLimit, async (_req, res) => {
  // Always respond with a generic message to avoid leaking account existence.
  res.status(202).json({ message: "If an account exists, password reset instructions were sent." });
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    await changePassword(req.auth!.userId, input.currentPassword, input.newPassword);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
