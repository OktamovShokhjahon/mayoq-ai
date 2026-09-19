import { AuditEvent } from "./audit-event.model";
import type { Role } from "../../shared/types";

export interface RecordAuditEventInput {
  tenantId: string;
  actorId: string;
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
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  await AuditEvent.create(input);
}
