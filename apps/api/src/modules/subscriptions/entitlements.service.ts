import { HttpError } from "../../middleware/errorHandler";
import { User } from "../users/user.model";
import { PatientProfile } from "../patients/patient.model";
import { TreatmentScenario } from "../ai-analysis/treatment-scenario.model";
import { Subscription, type SubscriptionDoc } from "./subscription.model";

/**
 * Entitlements are derived, never accumulated. A stored counter drifts the
 * moment a record is created outside the one code path that increments it —
 * and a clinic being told it has 0 doctors while three are working is worse
 * than a slightly more expensive query.
 */
export type EntitlementKind = "doctor" | "patient" | "aiAnalysis";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the window that `aiAnalysesThisPeriod` counts over. */
function periodStart(subscription: SubscriptionDoc): Date {
  if (subscription.currentPeriodEnd) {
    const periodDays = subscription.plan === "YEARLY" ? 365 : 30;
    const start = subscription.currentPeriodEnd.getTime() - periodDays * DAY_MS;
    if (start <= Date.now()) return new Date(start);
  }
  return new Date(Date.now() - 30 * DAY_MS);
}

export async function countUsage(tenantId: string, subscription: SubscriptionDoc) {
  const [doctorsCount, patientsCount, aiAnalysesThisPeriod] = await Promise.all([
    User.countDocuments({ tenantId, role: "DOCTOR", status: { $ne: "inactive" } }),
    PatientProfile.countDocuments({ tenantId, status: { $ne: "ARCHIVED" } }),
    TreatmentScenario.countDocuments({ tenantId, createdAt: { $gte: periodStart(subscription) } }),
  ]);
  return { doctorsCount, patientsCount, aiAnalysesThisPeriod };
}

/**
 * The subscription as the admin console should see it: live usage, whole days
 * of trial left, and the plain reason the clinic is or is not able to write.
 */
export async function getSubscriptionWithUsage(tenantId: string) {
  const subscription = await Subscription.findOne({ tenantId });
  if (!subscription) return null;

  const usage = await countUsage(tenantId, subscription);

  // Keep the stored copy in step so anything reading the document directly
  // (webhooks, exports) sees the same numbers the console shows.
  if (
    subscription.usage.doctorsCount !== usage.doctorsCount ||
    subscription.usage.patientsCount !== usage.patientsCount ||
    subscription.usage.aiAnalysesThisPeriod !== usage.aiAnalysesThisPeriod
  ) {
    subscription.usage = usage;
    await subscription.save();
  }

  const trialDaysRemaining = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - Date.now()) / DAY_MS))
    : undefined;

  return {
    ...subscription.toObject(),
    usage,
    trialDaysRemaining,
    writable: isWritable(subscription),
    lockReason: isWritable(subscription) ? undefined : lockReason(subscription),
  };
}

function trialExpired(subscription: SubscriptionDoc): boolean {
  return (
    subscription.state === "trialing" &&
    subscription.trialEndsAt !== undefined &&
    subscription.trialEndsAt.getTime() < Date.now()
  );
}

function isWritable(subscription: SubscriptionDoc): boolean {
  if (subscription.state === "canceled" || subscription.state === "expired") return false;
  return !trialExpired(subscription);
}

function lockReason(subscription: SubscriptionDoc): string {
  if (trialExpired(subscription)) return "The 7-day demo has ended. Existing records stay readable.";
  if (subscription.state === "canceled") return "This subscription was canceled. Existing records stay readable.";
  return "This subscription has expired. Existing records stay readable.";
}

const LIMIT_FIELD: Record<EntitlementKind, keyof SubscriptionDoc["limits"]> = {
  doctor: "maxDoctors",
  patient: "maxPatients",
  aiAnalysis: "maxAiAnalysesPerMonth",
};

const USAGE_FIELD: Record<EntitlementKind, keyof SubscriptionDoc["usage"]> = {
  doctor: "doctorsCount",
  patient: "patientsCount",
  aiAnalysis: "aiAnalysesThisPeriod",
};

const KIND_LABEL: Record<EntitlementKind, string> = {
  doctor: "doctor accounts",
  patient: "patients",
  aiAnalysis: "AI analyses this period",
};

/**
 * Called before creating anything a plan meters. A clinic over its limit is
 * locked out of *new* work only: nothing already recorded is deleted, hidden,
 * or made unreadable (spec 8.10 — graceful feature lock, never destructive).
 */
export async function assertEntitlement(tenantId: string, kind: EntitlementKind): Promise<void> {
  const subscription = await Subscription.findOne({ tenantId });
  // A clinic with no subscription row predates billing; do not lock it out.
  if (!subscription) return;

  if (!isWritable(subscription)) {
    throw new HttpError(402, lockReason(subscription));
  }

  const usage = await countUsage(tenantId, subscription);
  const limit = subscription.limits[LIMIT_FIELD[kind]];
  if (usage[USAGE_FIELD[kind]] >= limit) {
    throw new HttpError(
      402,
      `Your ${subscription.plan} plan allows ${limit} ${KIND_LABEL[kind]}. Upgrade the plan to add more.`
    );
  }
}
