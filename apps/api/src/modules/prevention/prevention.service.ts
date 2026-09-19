import { Diagnosis } from "../diagnoses/diagnosis.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { PatientProfile } from "../patients/patient.model";
import { HttpError } from "../../middleware/errorHandler";
import { buildPreventionPlan, type PreventionPlan, type PreventionSnapshot } from "./prevention-engine";

/**
 * Assembles the verified-only snapshot the prevention engine reads and returns
 * the plan for one patient.
 *
 * Mirrors how the clinical rules get their data on purpose: an AI-extracted
 * value a doctor has not approved never reaches the rules, and it must not
 * produce lifestyle advice either. A patient acting on an unverified number is
 * the same failure whichever module quoted it.
 */
export async function getPreventionPlanForPatient(
  tenantId: string,
  patientId: string
): Promise<PreventionPlan & { patientCode: string }> {
  const profile = await PatientProfile.findOne({ _id: patientId, tenantId });
  if (!profile) throw new HttpError(404, "Patient not found");

  const [diagnoses, labRecords] = await Promise.all([
    Diagnosis.find({ tenantId, patientId: profile._id }).lean(),
    MedicalRecord.find({ tenantId, patientId: profile._id, type: "lab_result" })
      .sort({ eventDate: -1 })
      .limit(50)
      .lean(),
  ]);

  const labValues: Record<string, number | undefined> = {};
  const labUnits: Record<string, string | undefined> = {};
  for (const record of labRecords) {
    if (record.verificationStatus === "ai_unverified" || record.verificationStatus === "rejected") continue;
    const data = record.data as Record<string, unknown>;
    const field = typeof data.field === "string" ? data.field : undefined;
    const value = typeof data.value === "number" ? data.value : undefined;
    // Records are newest-first, so the first value seen for a field wins.
    if (field && value !== undefined && labValues[field] === undefined) {
      labValues[field] = value;
      labUnits[field] = typeof data.unit === "string" ? data.unit : undefined;
    }
  }

  const snapshot: PreventionSnapshot = {
    diagnosisLabels: diagnoses.map((d) => d.label),
    labValues,
    labUnits,
    smokingStatus: profile.smokingStatus,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
  };

  return { ...buildPreventionPlan(snapshot), patientCode: profile.patientCode };
}
