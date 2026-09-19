import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { addMedicalRecord, listMedicalRecords, verifyMedicalRecord } from "./medical-record.service";
import { createRecordSchema } from "../patients/patient.validation";
import { recordAuditEvent } from "../audit/audit.service";

export const recordsRouter = Router({ mergeParams: true });
recordsRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"), stripClientTenantId);

recordsRouter.post("/", async (req, res, next) => {
  try {
    const input = createRecordSchema.parse(req.body);
    const record = await addMedicalRecord({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      type: input.type,
      eventDate: input.eventDate,
      data: input.data,
      sourceType: input.sourceType,
      status: input.status,
      note: input.note,
      createdBy: req.auth!.userId,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "medical_record.create",
      targetType: "MedicalRecord",
      targetId: String(record._id),
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

recordsRouter.get("/", async (req, res, next) => {
  try {
    const records = await listMedicalRecords(
      req.auth!.tenantId,
      (req.params as { patientId: string }).patientId,
      typeof req.query.type === "string" ? req.query.type : undefined
    );
    res.json(records);
  } catch (err) {
    next(err);
  }
});

export const recordVerifyRouter = Router();
recordVerifyRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

const verifySchema = z.object({ approve: z.boolean() });

recordVerifyRouter.patch("/:recordId", async (req, res, next) => {
  try {
    const input = verifySchema.parse(req.body);
    const record = await verifyMedicalRecord({
      tenantId: req.auth!.tenantId,
      recordId: req.params.recordId,
      verifiedBy: req.auth!.userId,
      approve: input.approve,
    });
    res.json(record);
  } catch (err) {
    next(err);
  }
});
