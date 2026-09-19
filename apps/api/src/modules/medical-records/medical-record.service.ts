import { HttpError } from "../../middleware/errorHandler";
import { MedicalRecord } from "./medical-record.model";
import { markScenarioStale } from "../ai-analysis/treatment-analysis.service";
import type { RecordType, SourceType, VerificationStatus } from "../../shared/types";

export async function addMedicalRecord(params: {
  tenantId: string;
  patientId: string;
  type: RecordType;
  eventDate: string;
  data: Record<string, unknown>;
  sourceType: SourceType;
  status: VerificationStatus;
  note?: string;
  createdBy: string;
}) {
  const record = await MedicalRecord.create({
    tenantId: params.tenantId,
    patientId: params.patientId,
    type: params.type,
    eventDate: new Date(params.eventDate),
    data: params.data,
    sourceType: params.sourceType,
    verificationStatus: params.status,
    note: params.note,
    createdBy: params.createdBy,
  });

  await markScenarioStale(params.tenantId, params.patientId);
  return record;
}

export async function listMedicalRecords(tenantId: string, patientId: string, type?: string) {
  const filter: Record<string, unknown> = { tenantId, patientId };
  if (type) filter.type = type;
  return MedicalRecord.find(filter).sort({ eventDate: -1 }).lean();
}

export async function verifyMedicalRecord(params: {
  tenantId: string;
  recordId: string;
  verifiedBy: string;
  approve: boolean;
}) {
  const record = await MedicalRecord.findOne({ _id: params.recordId, tenantId: params.tenantId });
  if (!record) throw new HttpError(404, "Record not found");

  record.verificationStatus = params.approve ? "verified" : "rejected";
  record.verifiedBy = params.verifiedBy as unknown as typeof record.verifiedBy;
  record.verifiedAt = new Date();
  record.version += 1;
  await record.save();

  if (params.approve) {
    await markScenarioStale(params.tenantId, String(record.patientId));
  }

  return record;
}
