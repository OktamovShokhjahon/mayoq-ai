import { HttpError } from "../../middleware/errorHandler";
import { Subscription } from "./subscription.model";
import type { SubscriptionPlan } from "../../shared/types";

/**
 * Billing-provider abstraction. Only a mock provider is implemented for the
 * hackathon demo, but the interface matches what a real provider (Stripe,
 * PayMe, Click, etc.) would need: a checkout session and a signed webhook.
 */
export interface BillingProvider {
  createCheckoutSession(tenantId: string, plan: SubscriptionPlan): Promise<{ checkoutUrl: string; sessionId: string }>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}

const processedEventIds = new Set<string>();

export class MockBillingProvider implements BillingProvider {
  async createCheckoutSession(tenantId: string, plan: SubscriptionPlan) {
    const sessionId = `mock_session_${tenantId}_${Date.now()}`;
    return { checkoutUrl: `https://billing.mock/checkout/${sessionId}?plan=${plan}`, sessionId };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    return signature === "mock-signature";
  }
}

export const billingProvider: BillingProvider = new MockBillingProvider();

export async function handleBillingWebhook(eventId: string, eventType: string, tenantId: string, plan: SubscriptionPlan) {
  if (processedEventIds.has(eventId)) {
    return { idempotent: true };
  }
  processedEventIds.add(eventId);

  const subscription = await Subscription.findOne({ tenantId });
  if (!subscription) throw new HttpError(404, "Subscription not found for tenant");

  if (eventType === "checkout.completed") {
    subscription.plan = plan;
    subscription.state = "active";
    subscription.currentPeriodEnd = new Date(Date.now() + (plan === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000);
  } else if (eventType === "payment.failed") {
    subscription.state = "past_due";
  } else if (eventType === "subscription.canceled") {
    subscription.state = "canceled";
  }

  await subscription.save();
  return { idempotent: false, subscription };
}
