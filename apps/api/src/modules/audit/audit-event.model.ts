import { Schema, model, Types } from "mongoose";
import type { Role } from "../../shared/types";

export interface AuditEventDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: Role;
  action: string;
  targetType: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  analysisId?: string;
  modelId?: string;
  ruleSetVersion?: string;
  createdAt: Date;
}

const auditEventSchema = new Schema<AuditEventDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, enum: ["ADMIN", "DOCTOR", "PATIENT"], required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    beforeSummary: { type: Schema.Types.Mixed },
    afterSummary: { type: Schema.Types.Mixed },
    analysisId: { type: String },
    modelId: { type: String },
    ruleSetVersion: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, capped: undefined }
);

auditEventSchema.index({ tenantId: 1, createdAt: -1 });

// Append-only from the application layer: no update/delete exposed via the service layer.
export const AuditEvent = model<AuditEventDoc>("AuditEvent", auditEventSchema);
