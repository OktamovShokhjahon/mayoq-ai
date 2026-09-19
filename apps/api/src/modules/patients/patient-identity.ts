import { PatientProfile } from "./patient.model";
import { User } from "../users/user.model";

/**
 * A dashboard row that says "Patient 6aad93e1…" is unreadable to the person
 * it is written for. Anything listing analyses resolves the patient's name and
 * code here, in one round trip, rather than leaking object ids into the UI.
 */
export async function attachPatientIdentity<T extends { patientId: unknown }>(
  tenantId: string,
  rows: T[]
): Promise<Array<T & { patientName?: string; patientCode?: string }>> {
  if (rows.length === 0) return [];

  const patientIds = [...new Set(rows.map((row) => String(row.patientId)))];
  const profiles = await PatientProfile.find({ tenantId, _id: { $in: patientIds } })
    .select("patientCode userId")
    .lean();
  const users = await User.find({ tenantId, _id: { $in: profiles.map((p) => p.userId) } })
    .select("fullName")
    .lean();

  const nameByUserId = new Map(users.map((u) => [String(u._id), u.fullName]));
  const identityByPatientId = new Map(
    profiles.map((p) => [
      String(p._id),
      { patientCode: p.patientCode, patientName: nameByUserId.get(String(p.userId)) },
    ])
  );

  return rows.map((row) => ({ ...row, ...identityByPatientId.get(String(row.patientId)) }));
}
