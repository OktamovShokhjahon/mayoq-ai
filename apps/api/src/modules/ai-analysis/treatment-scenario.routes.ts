import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { createTreatmentScenario, reviewScenario } from "./treatment-analysis.service";
import { TreatmentScenario } from "./treatment-scenario.model";
import { recordAuditEvent } from "../audit/audit.service";
import { HttpError } from "../../middleware/errorHandler";
import { assertEntitlement } from "../subscriptions/entitlements.service";
import { generatePatientSummary, approvePatientSummary } from "./patient-summary.service";

export const treatmentScenarioRouter = Router({ mergeParams: true });

const createScenarioSchema = z.object({
  diagnosisIds: z.array(z.string()).min(1),
  medicationIds: z.array(z.string()).min(1),
  // The doctor picks the window explicitly; both ends are recorded so the
  // projection can be read back against real dates, not a bare day count.
  projectionFrom: z.string().datetime().optional(),
  projectionTo: z.string().datetime(),
  /** The console's language, so the written explanation matches the page. */
  language: z.enum(["en", "ru", "uz"]).optional(),
});

treatmentScenarioRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"), stripClientTenantId);

treatmentScenarioRouter.post("/", async (req, res, next) => {
  try {
    const input = createScenarioSchema.parse(req.body);
    await assertEntitlement(req.auth!.tenantId, "aiAnalysis");
    const result = await createTreatmentScenario({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      diagnosisIds: input.diagnosisIds,
      medicationIds: input.medicationIds,
      projectionFrom: input.projectionFrom ? new Date(input.projectionFrom) : undefined,
      projectionTo: new Date(input.projectionTo),
      createdBy: req.auth!.userId,
      language: input.language,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "treatment_scenario.create",
      targetType: "TreatmentScenario",
      targetId: String(result.scenario._id),
      analysisId: String(result.scenario._id),
      modelId: result.scenario.modelId,
      ruleSetVersion: result.scenario.ruleSetVersion,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

treatmentScenarioRouter.get("/", async (req, res, next) => {
  try {
    const scenarios = await TreatmentScenario.find({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
    }).sort({ createdAt: -1 });
    res.json(scenarios);
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "DISCONTINUED"]),
  note: z.string().optional(),
  visibleToPatient: z.boolean().default(false),
});

export const scenarioReviewRouter = Router();
scenarioReviewRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

scenarioReviewRouter.post("/:scenarioId/review", async (req, res, next) => {
  try {
    const input = reviewSchema.parse(req.body);
    const scenario = await reviewScenario({
      tenantId: req.auth!.tenantId,
      scenarioId: req.params.scenarioId,
      reviewedBy: req.auth!.userId,
      decision: input.decision,
      note: input.note,
      visibleToPatient: input.visibleToPatient,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "treatment_scenario.review",
      targetType: "TreatmentScenario",
      targetId: String(scenario._id),
      afterSummary: { decision: input.decision },
    });

    res.json(scenario);
  } catch (err) {
    next(err);
  }
});

scenarioReviewRouter.post("/:scenarioId/recalculate", async (req, res, next) => {
  try {
    const scenario = await TreatmentScenario.findOne({ _id: req.params.scenarioId, tenantId: req.auth!.tenantId });
    if (!scenario) throw new HttpError(404, "Treatment scenario not found");

    const result = await createTreatmentScenario({
      tenantId: req.auth!.tenantId,
      patientId: String(scenario.patientId),
      diagnosisIds: scenario.diagnosisIds.map(String),
      medicationIds: scenario.medicationIds.map(String),
      // Re-running keeps the doctor's original window length, measured from now.
      projectionTo: new Date(Date.now() + scenario.horizonDays * 24 * 60 * 60 * 1000),
      createdBy: req.auth!.userId,
      language: z.enum(["en", "ru", "uz"]).optional().parse(req.body?.language),
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

scenarioReviewRouter.post("/:scenarioId/patient-summary", async (req, res, next) => {
  try {
    const result = await generatePatientSummary({
      tenantId: req.auth!.tenantId,
      scenarioId: req.params.scenarioId,
      language: z.enum(["en", "ru", "uz"]).optional().parse(req.body?.language),
    });
    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "treatment_scenario.patient_summary.generate",
      targetType: "TreatmentScenario",
      targetId: req.params.scenarioId,
      afterSummary: { aiAvailable: result.aiAvailable },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

scenarioReviewRouter.post("/:scenarioId/patient-summary/approve", async (req, res, next) => {
  try {
    const input = z.object({ text: z.string().min(1).max(2000).optional() }).parse(req.body);
    const scenario = await approvePatientSummary({
      tenantId: req.auth!.tenantId,
      scenarioId: req.params.scenarioId,
      approvedBy: req.auth!.userId,
      text: input.text,
    });
    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "treatment_scenario.patient_summary.approve",
      targetType: "TreatmentScenario",
      targetId: req.params.scenarioId,
    });
    res.json(scenario);
  } catch (err) {
    next(err);
  }
});
