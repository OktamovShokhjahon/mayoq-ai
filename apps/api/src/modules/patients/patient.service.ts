import crypto from "node:crypto";
import { HttpError } from "../../middleware/errorHandler";
import { hashPassword } from "../auth/auth.service";
import { User } from "../users/user.model";
import { PatientProfile } from "./patient.model";

function generatePatientCode(tenantId: string): string {
  return `PT-${tenantId.slice(-4).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createPatient(params: {
  tenantId: string;
  doctorId: string;
  fullName: string;
  email: string;
  password: string;
  dateOfBirth?: string;
  sex?: "male" | "female" | "other" | "unknown";
  phone?: string;
}) {
  const existing = await User.findOne({ tenantId: params.tenantId, email: params.email.toLowerCase() });
  if (existing) throw new HttpError(409, "A user with this email already exists in this clinic");

  const passwordHash = await hashPassword(params.password);

  const user = await User.create({
    tenantId: params.tenantId,
    role: "PATIENT",
    fullName: params.fullName,
    email: params.email,
    phone: params.phone,
    passwordHash,
    status: "must_change_password",
    createdBy: params.doctorId,
  });

  const profile = await PatientProfile.create({
    tenantId: params.tenantId,
    userId: user._id,
    patientCode: generatePatientCode(params.tenantId),
    dateOfBirth: params.dateOfBirth ? new Date(params.dateOfBirth) : undefined,
    sex: params.sex ?? "unknown",
    status: "INCOMPLETE",
    assignedDoctorIds: [params.doctorId],
  });

  return { user, profile };
}

export async function listPatients(params: {
  tenantId: string;
  doctorId?: string;
  search?: string;
  status?: string;
}) {
  const filter: Record<string, unknown> = { tenantId: params.tenantId };
  if (params.doctorId) filter.assignedDoctorIds = params.doctorId;
  if (params.status) filter.status = params.status;

  const profiles = await PatientProfile.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const userIds = profiles.map((p) => p.userId);
  const users = await User.find({ tenantId: params.tenantId, _id: { $in: userIds } })
    .select("fullName email phone")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  let results = profiles.map((p) => ({ ...p, user: userMap.get(String(p.userId)) }));

  if (params.search) {
    const term = params.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.user?.fullName.toLowerCase().includes(term) ||
        p.patientCode.toLowerCase().includes(term) ||
        p.user?.phone?.includes(term)
    );
  }

  return results;
}

export async function getPatientById(tenantId: string, patientId: string) {
  const profile = await PatientProfile.findOne({ _id: patientId, tenantId });
  if (!profile) throw new HttpError(404, "Patient not found");
  const user = await User.findOne({ _id: profile.userId, tenantId }).select("fullName email phone status");
  return { profile, user };
}

export async function archivePatient(tenantId: string, patientId: string): Promise<void> {
  const profile = await PatientProfile.findOne({ _id: patientId, tenantId });
  if (!profile) throw new HttpError(404, "Patient not found");
  profile.status = "ARCHIVED";
  profile.archivedAt = new Date();
  await profile.save();
}
