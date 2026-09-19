import { Schema, model, Types } from "mongoose";
import type { SubscriptionPlan, SubscriptionState } from "../../shared/types";

export interface SubscriptionDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  plan: SubscriptionPlan;
  state: SubscriptionState;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  provider: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  usage: { aiAnalysesThisPeriod: number; doctorsCount: number; patientsCount: number };
  limits: { maxDoctors: number; maxPatients: number; maxAiAnalysesPerMonth: number };
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true, unique: true },
    plan: { type: String, enum: ["DEMO", "MONTHLY", "YEARLY"], default: "DEMO" },
    state: {
      type: String,
      enum: ["trialing", "active", "past_due", "canceled", "expired"],
      default: "trialing",
    },
    trialEndsAt: { type: Date },
    currentPeriodEnd: { type: Date },
    provider: { type: String, default: "mock" },
    providerCustomerId: { type: String },
    providerSubscriptionId: { type: String },
    usage: {
      aiAnalysesThisPeriod: { type: Number, default: 0 },
      doctorsCount: { type: Number, default: 0 },
      patientsCount: { type: Number, default: 0 },
    },
    limits: {
      maxDoctors: { type: Number, default: 3 },
      maxPatients: { type: Number, default: 25 },
      maxAiAnalysesPerMonth: { type: Number, default: 50 },
    },
  },
  { timestamps: true }
);

export const Subscription = model<SubscriptionDoc>("Subscription", subscriptionSchema);
