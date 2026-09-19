import { Schema, model, Types } from "mongoose";
import type { PatientStatus } from "../../shared/types";

export interface PatientProfileDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  patientCode: string;
  dateOfBirth?: Date;
  sex?: "male" | "female" | "other" | "unknown";
  bloodGroup?: string;
  heightCm?: number;
  weightKg?: number;
  smokingStatus?: "never" | "former" | "current" | "unknown";
  consentStatus: "pending" | "granted" | "revoked";
  status: PatientStatus;
  assignedDoctorIds: Types.ObjectId[];
  emergencyContact?: { name: string; phone: string; relation?: string };
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

const patientProfileSchema = new Schema<PatientProfileDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientCode: { type: String, required: true },
    dateOfBirth: { type: Date },
    sex: { type: String, enum: ["male", "female", "other", "unknown"], default: "unknown" },
    bloodGroup: { type: String },
    heightCm: { type: Number },
    weightKg: { type: Number },
    smokingStatus: { type: String, enum: ["never", "former", "current", "unknown"], default: "unknown" },
    consentStatus: { type: String, enum: ["pending", "granted", "revoked"], default: "pending" },
    status: {
      type: String,
      enum: ["INCOMPLETE", "ACTIVE", "NEEDS_REVIEW", "FOLLOW_UP", "ARCHIVED"],
      default: "INCOMPLETE",
    },
    assignedDoctorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

patientProfileSchema.index({ tenantId: 1, patientCode: 1 }, { unique: true });
patientProfileSchema.index({ tenantId: 1, status: 1 });

export const PatientProfile = model<PatientProfileDoc>("PatientProfile", patientProfileSchema);
