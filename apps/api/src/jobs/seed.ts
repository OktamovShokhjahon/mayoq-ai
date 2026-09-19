import type { Types } from "mongoose";
import { connectDb, disconnectDb } from "../config/db";
import { logger } from "../config/logger";
import { registerClinic, hashPassword } from "../modules/auth/auth.service";
import { User } from "../modules/users/user.model";
import { PatientProfile } from "../modules/patients/patient.model";
import { Diagnosis } from "../modules/diagnoses/diagnosis.model";
import { Medication } from "../modules/medications/medication.model";
import { MedicalRecord } from "../modules/medical-records/medical-record.model";
import { createTreatmentScenario, reviewScenario } from "../modules/ai-analysis/treatment-analysis.service";
import { generatePatientSummary, approvePatientSummary } from "../modules/ai-analysis/patient-summary.service";
import { TreatmentScenario } from "../modules/ai-analysis/treatment-scenario.model";
import { Allergy } from "../modules/medications/allergy.model";
import { Tenant } from "../modules/tenants/tenant.model";
import { Subscription } from "../modules/subscriptions/subscription.model";
import { AuditEvent } from "../modules/audit/audit-event.model";
import { DocumentModel } from "../modules/documents/document.model";
import { AIJob } from "../modules/ai-analysis/ai-job.model";
import { generateDemoCases, type GeneratedCase } from "./case-generator";

/**
 * Seeds one demo clinic of synthetic patients.
 *
 * Sign-in details are fixed here — a demo nobody can log into is useless — and
 * everything clinical is generated: the model invents the conditions,
 * medications, allergies and result histories, and the product's own pipeline
 * then produces the findings from them, exactly as it would for a real patient.
 * Nothing in this file states a risk, a colour or a conclusion.
 *
 * Never run against a production database.
 */

/** The accounts. These, and only these, are written by hand. */
const LOGINS = {
  clinic: {
    clinicName: "TwinRx Demo Clinic",
    contactEmail: "demo@twinrx.example",
    adminFullName: "Demo Admin",
    adminEmail: "admin@twinrx.example",
    password: "DemoAdminPass123!",
  },
  doctor: { fullName: "Dr. Aziza Karimova", email: "doctor@twinrx.example", password: "DemoDoctorPass123!" },
  patientPassword: "DemoPatientPass123!",
  patients: {
    alpha: { fullName: "Synthetic Patient Alpha", email: "patient1@twinrx.example" },
    beta: { fullName: "Synthetic Patient Beta", email: "patient2@twinrx.example" },
    gamma: { fullName: "Synthetic Patient Gamma", email: "patient3@twinrx.example" },
  },
} as const;

/**
 * The free tier counts requests per minute, and this script makes several in a
 * row. Spacing them keeps the seed from being throttled halfway through and
 * silently producing analyses without their written explanations.
 */
const AI_CALL_SPACING_MS = 14000;
function pace(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, AI_CALL_SPACING_MS));
}

/** Projection windows are absolute dates, so seeded scenarios read like real ones. */
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Analyses all created in the same second make the clinic's activity chart a
 * single dot. Backdating spreads the demo history over the past fortnight so
 * the trend reads like a clinic that has been running.
 */
async function backdateScenario(scenarioId: Types.ObjectId, days: number): Promise<void> {
  // Mongoose marks a timestamps-managed `createdAt` immutable and silently
  // drops it from an update, so this goes through the driver directly.
  await TreatmentScenario.collection.updateOne(
    { _id: scenarioId },
    { $set: { createdAt: daysAgo(days), updatedAt: daysAgo(days) } }
  );
}

async function seed() {
  await connectDb();

  // Re-seeding would otherwise fail halfway through on the duplicate clinic
  // slug, leaving a half-built demo. Removing data is never implicit.
  const existing = await Tenant.findOne({ slug: "twinrx-demo-clinic" });
  if (existing) {
    if (!process.argv.includes("--reset")) {
      logger.error(
        "The demo clinic already exists. Re-run with --reset to delete it and seed a fresh one."
      );
      await disconnectDb();
      process.exit(1);
    }
    await resetDemoTenant(String(existing._id));
    logger.info({ tenantId: String(existing._id) }, "Removed the previous demo clinic");
  }

  // Generated before anything is written, so a failure here leaves no clinic
  // behind and never falls back to canned values.
  logger.info("Generating synthetic cases with the model...");
  const generated = await generateDemoCases();
  logger.info(
    { modelId: generated.modelId, cases: generated.cases.map((c) => `${c.slot}:${c.patientCode}`) },
    "Cases generated"
  );

  const { tenant, admin } = await registerClinic(LOGINS.clinic);

  const doctorPasswordHash = await hashPassword(LOGINS.doctor.password);
  const doctor = await User.create({
    tenantId: tenant._id,
    role: "DOCTOR",
    fullName: LOGINS.doctor.fullName,
    email: LOGINS.doctor.email,
    passwordHash: doctorPasswordHash,
    status: "active",
    createdBy: admin._id,
  });

  const patientPasswordHash = await hashPassword(LOGINS.patientPassword);

  /**
   * Writes one generated case into the record as a patient with a fixed login.
   * The order matters: results go in before any analysis runs, so the rules
   * read the same history a doctor would see on the chart.
   */
  async function seedCase(item: GeneratedCase) {
    const login = LOGINS.patients[item.slot];
    const user = await User.create({
      tenantId: tenant._id,
      role: "PATIENT",
      fullName: login.fullName,
      email: login.email,
      passwordHash: patientPasswordHash,
      status: "active",
      createdBy: doctor._id,
    });

    const profile = await PatientProfile.create({
      tenantId: tenant._id,
      userId: user._id,
      patientCode: item.patientCode,
      // Year of birth only: a generated day and month would be invented detail
      // with no purpose, and age is all any rule or projection reads.
      dateOfBirth: new Date(Date.UTC(item.birthYear, 0, 1)),
      sex: item.sex,
      smokingStatus: item.smokingStatus,
      heightCm: item.heightCm,
      weightKg: item.weightKg,
      status: "ACTIVE",
      consentStatus: "granted",
      assignedDoctorIds: [doctor._id],
    });

    const diagnoses = await Diagnosis.insertMany(
      item.diagnoses.map((entry) => ({
        tenantId: tenant._id,
        patientId: profile._id,
        label: entry.label,
        state: "active",
        diagnosedAt: daysAgo(entry.diagnosedDaysAgo),
        createdBy: doctor._id,
      }))
    );

    const medications = await Medication.insertMany(
      item.medications.map((entry) => ({
        tenantId: tenant._id,
        patientId: profile._id,
        genericName: entry.genericName,
        dosage: entry.dosage,
        unit: entry.unit,
        route: entry.route,
        frequency: entry.frequency,
        // A proposed medicine starts today; established therapy has been
        // running as long as the condition it treats.
        startDate: entry.proposed ? new Date() : daysAgo(Math.min(item.diagnoses[0].diagnosedDaysAgo, 400)),
        status: "active",
        purpose: entry.purpose,
        createdBy: doctor._id,
      }))
    );

    if (item.allergies.length > 0) {
      await Allergy.insertMany(
        item.allergies.map((entry) => ({
          tenantId: tenant._id,
          patientId: profile._id,
          substance: entry.substance,
          reaction: entry.reaction,
          severity: entry.severity,
          verificationStatus: "verified",
          createdBy: doctor._id,
        }))
      );
    }

    await MedicalRecord.insertMany(
      item.readings.map((reading) => ({
        tenantId: tenant._id,
        patientId: profile._id,
        type: "lab_result",
        eventDate: daysAgo(reading.daysAgo),
        data: { field: reading.field, value: reading.value, unit: reading.unit },
        sourceType: "laboratory",
        // Seeded results stand for values a doctor already confirmed, which is
        // what the rules are allowed to read.
        verificationStatus: "verified",
        verifiedBy: doctor._id,
        verifiedAt: daysAgo(reading.daysAgo),
        createdBy: doctor._id,
      }))
    );

    return { user, profile, diagnoses, medications };
  }

  const seeded: Record<string, Awaited<ReturnType<typeof seedCase>>> = {};
  for (const item of generated.cases) {
    seeded[item.slot] = await seedCase(item);
  }

  // The analyses. These run through the ordinary pipeline — the deterministic
  // rule catalog over the generated record, explained by the model — so the
  // demo's findings are produced the same way a real patient's would be.
  const scenarios: Array<{ slot: string; id: Types.ObjectId }> = [];
  let age = 11;
  for (const item of generated.cases) {
    const entry = seeded[item.slot];
    await pace();
    const result = await createTreatmentScenario({
      tenantId: String(tenant._id),
      patientId: String(entry.profile._id),
      diagnosisIds: entry.diagnoses.map((d) => String(d._id)),
      medicationIds: entry.medications.map((m) => String(m._id)),
      projectionTo: daysFromNow(item.horizonDays),
      createdBy: String(doctor._id),
    });
    await backdateScenario(result.scenario._id, age);
    scenarios.push({ slot: item.slot, id: result.scenario._id });
    // Spread across the past fortnight so the clinic activity chart has shape.
    age = Math.max(1, age - 5);
  }

  // One analysis arrives already reviewed and published, so the patient-facing
  // twin has something to show the moment the demo starts. The doctor's
  // decision is recorded without a note: inventing words and attributing them
  // to a named physician is not something a seed should do.
  const published = scenarios[scenarios.length - 1];
  await reviewScenario({
    tenantId: String(tenant._id),
    scenarioId: String(published.id),
    reviewedBy: String(doctor._id),
    decision: "APPROVED",
    visibleToPatient: true,
  });

  // The patient-facing wording is written by the model from that analysis, the
  // same call the console makes, and then approved for publication.
  await pace();
  const summary = await generatePatientSummary({
    tenantId: String(tenant._id),
    scenarioId: String(published.id),
  });
  if (summary.aiAvailable) {
    await approvePatientSummary({
      tenantId: String(tenant._id),
      scenarioId: String(published.id),
      approvedBy: String(doctor._id),
    });
  } else {
    logger.warn(
      { error: summary.aiError },
      "No patient summary was written, so this analysis stays internal. The doctor console can generate it later."
    );
  }

  logger.info(
    {
      tenantSlug: tenant.slug,
      adminEmail: admin.email,
      doctorEmail: doctor.email,
      patients: generated.cases.map((c) => `${LOGINS.patients[c.slot].email} (${c.patientCode})`),
      generatedBy: generated.modelId,
    },
    "Seed complete. Every clinical value was generated; all patients are synthetic and fictional."
  );

  await disconnectDb();
}

/** Deletes every record belonging to the demo clinic. Demo tenant only. */
async function resetDemoTenant(tenantId: string): Promise<void> {
  await Promise.all([
    User.deleteMany({ tenantId }),
    PatientProfile.deleteMany({ tenantId }),
    Diagnosis.deleteMany({ tenantId }),
    Medication.deleteMany({ tenantId }),
    Allergy.deleteMany({ tenantId }),
    MedicalRecord.deleteMany({ tenantId }),
    TreatmentScenario.deleteMany({ tenantId }),
    Subscription.deleteMany({ tenantId }),
    AuditEvent.deleteMany({ tenantId }),
    DocumentModel.deleteMany({ tenantId }),
    AIJob.deleteMany({ tenantId }),
    Tenant.deleteOne({ _id: tenantId }),
  ]);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
