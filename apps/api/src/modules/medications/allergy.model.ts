import { Schema, model, Types } from "mongoose";

export interface AllergyDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  substance: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe" | "unknown";
  verificationStatus: "unverified" | "verified";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const allergySchema = new Schema<AllergyDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    substance: { type: String, required: true },
    reaction: { type: String },
    severity: { type: String, enum: ["mild", "moderate", "severe", "unknown"], default: "unknown" },
    verificationStatus: { type: String, enum: ["unverified", "verified"], default: "unverified" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Allergy = model<AllergyDoc>("Allergy", allergySchema);
