import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { Medication } from "./medication.model";
import { Allergy } from "./allergy.model";
import { markScenarioStale } from "../ai-analysis/treatment-analysis.service";
import { recordAuditEvent } from "../audit/audit.service";

export const medicationRouter = Router({ mergeParams: true });

const createMedicationSchema = z.object({
  genericName: z.string().min(2),
  brandName: z.string().optional(),
  dosage: z.number().positive(),
  unit: z.string().min(1),
  route: z.string().min(1),
  frequency: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  purpose: z.string().optional(),
});

const createAllergySchema = z.object({
  substance: z.string().min(1),
  reaction: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]).default("unknown"),
});

medicationRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"), stripClientTenantId);

medicationRouter.post("/", async (req, res, next) => {
  try {
    const input = createMedicationSchema.parse(req.body);
    const medication = await Medication.create({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      ...input,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      createdBy: req.auth!.userId,
    });

    await markScenarioStale(req.auth!.tenantId, (req.params as { patientId: string }).patientId);
    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "medication.create",
      targetType: "Medication",
      targetId: String(medication._id),
    });

    res.status(201).json(medication);
  } catch (err) {
    next(err);
  }
});

medicationRouter.get("/", async (req, res, next) => {
  try {
    const meds = await Medication.find({ tenantId: req.auth!.tenantId, patientId: (req.params as { patientId: string }).patientId }).sort({
      startDate: -1,
    });
    res.json(meds);
  } catch (err) {
    next(err);
  }
});

export const allergyRouter = Router({ mergeParams: true });
allergyRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"), stripClientTenantId);

allergyRouter.post("/", async (req, res, next) => {
  try {
    const input = createAllergySchema.parse(req.body);
    const allergy = await Allergy.create({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      ...input,
      createdBy: req.auth!.userId,
    });
    res.status(201).json(allergy);
  } catch (err) {
    next(err);
  }
});

allergyRouter.get("/", async (req, res, next) => {
  try {
    const allergies = await Allergy.find({ tenantId: req.auth!.tenantId, patientId: (req.params as { patientId: string }).patientId });
    res.json(allergies);
  } catch (err) {
    next(err);
  }
});
