import { Schema, model, Types } from "mongoose";

/**
 * Model-written elaboration of a diagnosis the doctor entered. It is an
 * interpretation, not a fact: it lands unverified and only a doctor
 * can promote it (technical mission §5).
 */
export interface DiagnosisAiDetail {
  summary: string;
  monitoring: string[];
  verifyBeforeTreating: string[];
  redFlags: string[];
  modelId: string;
  promptVersion: string;
  generatedAt: Date;
  verificationStatus: "ai_unverified" | "verified" | "rejected";
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
}

export interface DiagnosisDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  label: string;
  icdCode?: string;
  isCustomLabel: boolean;
  doctorNote?: string;
  state: "active" | "historical";
  diagnosedAt: Date;
  aiDetail?: DiagnosisAiDetail;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const diagnosisSchema = new Schema<DiagnosisDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    label: { type: String, required: true },
    icdCode: { type: String },
    isCustomLabel: { type: Boolean, default: false },
    doctorNote: { type: String },
    state: { type: String, enum: ["active", "historical"], default: "active" },
    diagnosedAt: { type: Date, required: true },
    aiDetail: {
      summary: String,
      monitoring: [String],
      verifyBeforeTreating: [String],
      redFlags: [String],
      modelId: String,
      promptVersion: String,
      generatedAt: Date,
      verificationStatus: {
        type: String,
        enum: ["ai_unverified", "verified", "rejected"],
        default: "ai_unverified",
      },
      verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
      verifiedAt: Date,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

diagnosisSchema.pre("validate", function (next) {
  if (this.isCustomLabel && !this.doctorNote) {
    next(new Error("doctorNote is mandatory for a custom diagnosis label"));
    return;
  }
  next();
});

export const Diagnosis = model<DiagnosisDoc>("Diagnosis", diagnosisSchema);
