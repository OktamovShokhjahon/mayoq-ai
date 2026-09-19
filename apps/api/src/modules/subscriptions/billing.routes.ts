import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { HttpError } from "../../middleware/errorHandler";
import { billingProvider, handleBillingWebhook } from "./billing.service";
import { getSubscriptionWithUsage } from "./entitlements.service";
import { env } from "../../config/env";

export const billingRouter = Router();

const checkoutSchema = z.object({ plan: z.enum(["MONTHLY", "YEARLY"]) });

billingRouter.post("/checkout-session", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    const session = await billingProvider.createCheckoutSession(req.auth!.tenantId, input.plan);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

billingRouter.get("/subscription", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const subscription = await getSubscriptionWithUsage(req.auth!.tenantId);
    res.json(subscription);
  } catch (err) {
    next(err);
  }
});

const webhookEventSchema = z.object({
  eventId: z.string(),
  eventType: z.enum(["checkout.completed", "payment.failed", "subscription.canceled"]),
  tenantId: z.string(),
  plan: z.enum(["DEMO", "MONTHLY", "YEARLY"]).default("MONTHLY"),
});

billingRouter.post("/webhooks/provider", async (req, res, next) => {
  try {
    const signature = req.headers["x-billing-signature"] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (env.billingProvider === "mock") {
      const expected = crypto.createHmac("sha256", env.billingWebhookSecret).update(rawBody).digest("hex");
      if (signature !== `mock-signature` && signature !== expected) {
        throw new HttpError(401, "Invalid webhook signature");
      }
    } else if (!billingProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new HttpError(401, "Invalid webhook signature");
    }

    const input = webhookEventSchema.parse(req.body);
    const result = await handleBillingWebhook(input.eventId, input.eventType, input.tenantId, input.plan);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
