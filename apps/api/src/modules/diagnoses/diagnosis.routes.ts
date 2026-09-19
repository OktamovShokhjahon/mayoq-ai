import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { Diagnosis } from "./diagnosis.model";
import { markScenarioStale } from "../ai-analysis/treatment-analysis.service";
import { generateDiagnosisDetail, reviewDiagnosisDetail } from "./diagnosis-detail.service";
import { recordAuditEvent } from "../audit/audit.service";

export const diagnosisRouter = Router({ mergeParams: true });

const createDiagnosisSchema = z.object({
  label: z.string().min(2),
  icdCode: z.string().optional(),
  isCustomLabel: z.boolean().default(false),
  doctorNote: z.string().optional(),
  diagnosedAt: z.string().datetime(),
});

diagnosisRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"), stripClientTenantId);

diagnosisRouter.post("/", async (req, res, next) => {
  try {
    const input = createDiagnosisSchema.parse(req.body);
    const diagnosis = await Diagnosis.create({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      ...input,
      diagnosedAt: new Date(input.diagnosedAt),
      createdBy: req.auth!.userId,
    });

    await markScenarioStale(req.auth!.tenantId, (req.params as { patientId: string }).patientId);
    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "diagnosis.create",
      targetType: "Diagnosis",
      targetId: String(diagnosis._id),
    });

    res.status(201).json(diagnosis);
  } catch (err) {
    next(err);
  }
});

/**
 * Expands a diagnosis into clinical context. Kept as its own call rather than
 * folded into create: the model can be slow or unreachable, and adding a
 * diagnosis must never fail because of it.
 */
diagnosisRouter.post("/:diagnosisId/detail", async (req, res, next) => {
  try {
    const params = req.params as { patientId: string; diagnosisId: string };
    const result = await generateDiagnosisDetail({
      tenantId: req.auth!.tenantId,
      patientId: params.patientId,
      diagnosisId: params.diagnosisId,
      language: z.enum(["en", "ru", "uz"]).optional().parse(req.body?.language),
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "diagnosis.detail.generate",
      targetType: "Diagnosis",
      targetId: params.diagnosisId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

const reviewDetailSchema = z.object({ approve: z.boolean() });

diagnosisRouter.post("/:diagnosisId/detail/review", async (req, res, next) => {
  try {
    const params = req.params as { patientId: string; diagnosisId: string };
    const input = reviewDetailSchema.parse(req.body);
    const diagnosis = await reviewDiagnosisDetail({
      tenantId: req.auth!.tenantId,
      patientId: params.patientId,
      diagnosisId: params.diagnosisId,
      reviewedBy: req.auth!.userId,
      approve: input.approve,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: input.approve ? "diagnosis.detail.approve" : "diagnosis.detail.reject",
      targetType: "Diagnosis",
      targetId: params.diagnosisId,
    });

    res.json(diagnosis);
  } catch (err) {
    next(err);
  }
});

diagnosisRouter.get("/", async (req, res, next) => {
  try {
    const diagnoses = await Diagnosis.find({ tenantId: req.auth!.tenantId, patientId: (req.params as { patientId: string }).patientId }).sort({
      diagnosedAt: -1,
    });
    res.json(diagnoses);
  } catch (err) {
    next(err);
  }
});
