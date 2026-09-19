import { Schema, model, Types } from "mongoose";
import type { RecordType, SourceType, VerificationStatus } from "../../shared/types";

export interface MedicalRecordDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  type: RecordType;
  eventDate: Date;
  data: Record<string, unknown>;
  sourceType: SourceType;
  sourceDocumentId?: Types.ObjectId;
  verificationStatus: VerificationStatus;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  sourceReferences: Array<{ documentId?: Types.ObjectId; page?: number; span?: string }>;
  note?: string;
  version: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

const medicalRecordSchema = new Schema<MedicalRecordDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    type: {
      type: String,
      enum: [
        "diagnosis",
        "medication",
        "allergy",
        "symptom",
        "lab_result",
        "vital_sign",
        "procedure",
        "document",
        "lifestyle_observation",
      ],
      required: true,
    },
    eventDate: { type: Date, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    sourceType: {
      type: String,
      enum: ["doctor_entry", "external_document", "patient_report", "laboratory", "other"],
      required: true,
    },
    sourceDocumentId: { type: Schema.Types.ObjectId, ref: "Document" },
    verificationStatus: {
      type: String,
      enum: ["unverified", "ai_unverified", "verified", "historical", "resolved", "active", "rejected"],
      default: "unverified",
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    sourceReferences: [
      {
        documentId: { type: Schema.Types.ObjectId, ref: "Document" },
        page: Number,
        span: String,
      },
    ],
    note: { type: String },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ tenantId: 1, patientId: 1, eventDate: -1 });
medicalRecordSchema.index({ tenantId: 1, patientId: 1, type: 1 });

export const MedicalRecord = model<MedicalRecordDoc>("MedicalRecord", medicalRecordSchema);
