import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { HttpError } from "../../middleware/errorHandler";
import { PatientProfile } from "./patient.model";
import { User } from "../users/user.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";
import { TreatmentScenario } from "../ai-analysis/treatment-scenario.model";
import { getPreventionPlanForPatient } from "../prevention/prevention.service";
import { explainPreventionPlan } from "../prevention/prevention-narrative.service";
import { runDeepAnalysis } from "../deep-analysis/deep-analysis.service";
import { recordAuditEvent } from "../audit/audit.service";

export const meRouter = Router();
meRouter.use(requireAuth, requireRole("PATIENT"));

async function getOwnProfile(userId: string, tenantId: string) {
  const profile = await PatientProfile.findOne({ userId, tenantId });
  if (!profile) throw new HttpError(404, "Patient profile not found");
  return profile;
}

meRouter.get("/profile", async (req, res, next) => {
  try {
    const [profile, user] = await Promise.all([
      getOwnProfile(req.auth!.userId, req.auth!.tenantId),
      User.findById(req.auth!.userId).select("fullName email phone"),
    ]);
    res.json({ profile, user });
  } catch (err) {
    next(err);
  }
});

// Patients only ever see verified records — anything AI-unverified or a
// physician-internal note stays hidden until a doctor approves it.
meRouter.get("/medical-history", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const records = await MedicalRecord.find({
      tenantId: req.auth!.tenantId,
      patientId: profile._id,
      verificationStatus: "verified",
    }).sort({ eventDate: -1 });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

meRouter.get("/diagnoses", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const diagnoses = await Diagnosis.find({ tenantId: req.auth!.tenantId, patientId: profile._id });
    res.json(diagnoses);
  } catch (err) {
    next(err);
  }
});

meRouter.get("/medications", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const medications = await Medication.find({ tenantId: req.auth!.tenantId, patientId: profile._id, status: "active" });
    res.json(medications);
  } catch (err) {
    next(err);
  }
});

meRouter.get("/approved-scenarios", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const scenarios = await TreatmentScenario.find({
      tenantId: req.auth!.tenantId,
      patientId: profile._id,
      status: "APPROVED",
      "doctorReview.visibleToPatient": true,
      // Publishing needs both ticks: the doctor's decision and an approved
      // plain-language summary. One without the other stays internal, and an
      // unapproved model draft therefore never reaches this response.
      "patientSummary.approved": true,
    }).sort({ createdAt: -1 });
    res.json(scenarios);
  } catch (err) {
    next(err);
  }
});

/**
 * The patient's prevention plan. Unlike a treatment scenario this needs no
 * doctor approval to be shown, because the catalog behind it cannot say
 * anything about medication — see `prevention-catalog.ts`. It is built only
 * from values a doctor has already verified.
 */
meRouter.get("/prevention-plan", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const plan = await getPreventionPlanForPatient(req.auth!.tenantId, String(profile._id));
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    res.json({ ...plan, plainLanguage: await explainPreventionPlan(plan, req.auth!.tenantId, lang) });
  } catch (err) {
    next(err);
  }
});

/**
 * The patient's own deep analysis. Same engine as the doctor's, narrowed: only
 * verified readings, only scenarios the doctor approved and published, no drug
 * label detail and no considerations aimed at a prescriber.
 */
meRouter.post("/deep-analysis", async (req, res, next) => {
  try {
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const language = typeof req.body?.language === "string" ? req.body.language : undefined;
    const report = await runDeepAnalysis({
      tenantId: req.auth!.tenantId,
      patientId: String(profile._id),
      audience: "patient",
      language,
      refresh: req.body?.refresh === true,
    });
    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "deep_analysis.run",
      targetType: "PatientProfile",
      targetId: String(profile._id),
      modelId: report.ai.modelId,
      ruleSetVersion: report.coverage.ruleSetVersion,
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

const followUpSchema = z.object({
  note: z.string().min(1).max(2000),
  symptomTags: z.array(z.string()).default([]),
});

meRouter.post("/follow-up-observations", async (req, res, next) => {
  try {
    const input = followUpSchema.parse(req.body);
    const profile = await getOwnProfile(req.auth!.userId, req.auth!.tenantId);
    const record = await MedicalRecord.create({
      tenantId: req.auth!.tenantId,
      patientId: profile._id,
      type: "symptom",
      eventDate: new Date(),
      data: { note: input.note, symptomTags: input.symptomTags },
      sourceType: "patient_report",
      verificationStatus: "unverified",
      createdBy: req.auth!.userId,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});
