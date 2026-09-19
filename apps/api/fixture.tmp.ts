import mongoose from "mongoose";
import { connectDb } from "./src/config/db";
import { Tenant } from "./src/modules/tenants/tenant.model";
import { User } from "./src/modules/users/user.model";
import { PatientProfile } from "./src/modules/patients/patient.model";
import { Diagnosis } from "./src/modules/diagnoses/diagnosis.model";
import { MedicalRecord } from "./src/modules/medical-records/medical-record.model";
import { hashPassword } from "./src/modules/auth/auth.service";

async function main() {
  await connectDb();
  const slug = "chain-fixture";
  await Tenant.deleteMany({ slug });
  const tenant = await Tenant.create({ name: "Chain Fixture Clinic", slug, contactEmail: "f@x.example", status: "active" });
  const tenantId = tenant._id;
  await User.deleteMany({ email: { $in: ["chainfix@twinrx.example", "chainpt@twinrx.example"] } });

  const doctor = await User.create({
    tenantId, role: "DOCTOR", fullName: "Dr Fixture", email: "chainfix@twinrx.example",
    passwordHash: await hashPassword("FixturePass123!"), status: "active",
  });
  const patientUser = await User.create({
    tenantId, role: "PATIENT", fullName: "Fixture Patient", email: "chainpt@twinrx.example",
    passwordHash: await hashPassword("FixturePass123!"), status: "active", createdBy: doctor._id,
  });
  const profile = await PatientProfile.create({
    tenantId, userId: patientUser._id, patientCode: "PT-CHAIN-1", sex: "female",
    dateOfBirth: new Date("1968-04-02"), status: "ACTIVE", assignedDoctorIds: [doctor._id],
  });

  await Diagnosis.insertMany([
    { tenantId, patientId: profile._id, label: "Type 2 diabetes mellitus", state: "active", diagnosedAt: new Date("2019-05-01"), createdBy: doctor._id },
    { tenantId, patientId: profile._id, label: "Arterial hypertension", state: "active", diagnosedAt: new Date("2020-02-01"), createdBy: doctor._id },
    { tenantId, patientId: profile._id, label: "Diabetic retinopathy", state: "active", diagnosedAt: new Date("2024-06-01"), createdBy: doctor._id },
  ]);

  const lab = (field: string, value: number, unit: string) => ({
    tenantId, patientId: profile._id, type: "lab_result", eventDate: new Date(),
    data: { field, value, unit, description: field }, sourceType: "laboratory",
    verificationStatus: "verified", verifiedBy: doctor._id, verifiedAt: new Date(), createdBy: doctor._id,
  });
  await MedicalRecord.insertMany([
    lab("latestEgfr", 52, "mL/min"),
    lab("latestSystolicBp", 168, "mmHg"),
    lab("latestPotassium", 5.4, "mmol/L"),
    // Unverified: must NOT influence the chain map.
    { ...lab("latestHba1c", 11.2, "%"), verificationStatus: "ai_unverified", verifiedBy: undefined, verifiedAt: undefined },
  ]);

  console.log(JSON.stringify({ patientId: String(profile._id), doctorEmail: "chainfix@twinrx.example" }));
  await mongoose.connection.close();
}
main();
