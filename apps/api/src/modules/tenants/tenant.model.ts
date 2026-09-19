import { Schema, model, Types } from "mongoose";

export interface TenantDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  contactEmail: string;
  status: "active" | "suspended";
  subscriptionId?: Types.ObjectId;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    trialEndsAt: { type: Date },
  },
  { timestamps: true }
);

export const Tenant = model<TenantDoc>("Tenant", tenantSchema);
