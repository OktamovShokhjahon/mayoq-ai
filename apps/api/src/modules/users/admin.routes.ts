import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { HttpError } from "../../middleware/errorHandler";
import { User } from "./user.model";
import { PatientProfile } from "../patients/patient.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { AuditEvent } from "../audit/audit-event.model";
import { Subscription } from "../subscriptions/subscription.model";
import { TreatmentScenario } from "../ai-analysis/treatment-scenario.model";
import { hashPassword } from "../auth/auth.service";
import { recordAuditEvent } from "../audit/audit.service";
import { assertEntitlement, getSubscriptionWithUsage } from "../subscriptions/entitlements.service";
import { attachPatientIdentity } from "../patients/patient-identity";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"), stripClientTenantId);

adminRouter.get("/dashboard", async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const [activeDoctors, activePatients, patientsByStatus, recentAnalyses, highRiskAlerts] = await Promise.all([
      User.countDocuments({ tenantId, role: "DOCTOR", status: "active" }),
      PatientProfile.countDocuments({ tenantId, status: { $ne: "ARCHIVED" } }),
      PatientProfile.aggregate([{ $match: { tenantId: new Types.ObjectId(tenantId) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      TreatmentScenario.find({ tenantId }).sort({ createdAt: -1 }).limit(10).lean(),
      TreatmentScenario.countDocuments({ tenantId, overallRisk: "red" }),
    ]);

    res.json({
      activeDoctors,
      activePatients,
      patientsByStatus,
      recentAnalyses: await attachPatientIdentity(tenantId, recentAnalyses),
      highRiskAlerts,
    });
  } catch (err) {
    next(err);
  }
});

const createDoctorSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(5).max(40).optional(),
  // The admin types this and hands it over, so it is never generated here and
  // never echoed back. The account stays flagged as not self-chosen.
  password: z.string().min(10).max(200),
});

adminRouter.get("/doctors", async (req, res, next) => {
  try {
    const doctors = await User.find({ tenantId: req.auth!.tenantId, role: "DOCTOR" }).select("-passwordHash");
    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/doctors", async (req, res, next) => {
  try {
    const input = createDoctorSchema.parse(req.body);
    await assertEntitlement(req.auth!.tenantId, "doctor");
    const existing = await User.findOne({ tenantId: req.auth!.tenantId, email: input.email.toLowerCase() });
    if (existing) throw new HttpError(409, "A user with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const doctor = await User.create({
      tenantId: req.auth!.tenantId,
      role: "DOCTOR",
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      status: "must_change_password",
      createdBy: req.auth!.userId,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: "ADMIN",
      action: "doctor.create",
      targetType: "User",
      targetId: String(doctor._id),
    });

    // The password is never echoed back: the admin typed it and already has it.
    res.status(201).json({
      doctor: {
        id: doctor._id,
        email: doctor.email,
        fullName: doctor.fullName,
        phone: doctor.phone,
        status: doctor.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

const patchDoctorSchema = z.object({ status: z.enum(["active", "inactive"]).optional() });

adminRouter.patch("/doctors/:doctorId", async (req, res, next) => {
  try {
    const input = patchDoctorSchema.parse(req.body);
    const doctor = await User.findOneAndUpdate(
      { _id: req.params.doctorId, tenantId: req.auth!.tenantId, role: "DOCTOR" },
      { $set: input, ...(input.status === "inactive" ? { $inc: { tokenVersion: 1 } } : {}) },
      { new: true }
    ).select("-passwordHash");
    if (!doctor) throw new HttpError(404, "Doctor not found");
    res.json(doctor);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/doctors/:doctorId/reset-password", async (req, res, next) => {
  try {
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);
    const doctor = await User.findOneAndUpdate(
      { _id: req.params.doctorId, tenantId: req.auth!.tenantId, role: "DOCTOR" },
      { $set: { passwordHash, status: "must_change_password" }, $inc: { tokenVersion: 1 } },
      { new: true }
    );
    if (!doctor) throw new HttpError(404, "Doctor not found");
    res.json({ tempPassword });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/patients", async (req, res, next) => {
  try {
    const patients = await PatientProfile.find({ tenantId: req.auth!.tenantId }).sort({ createdAt: -1 }).lean();
    const users = await User.find({ tenantId: req.auth!.tenantId, _id: { $in: patients.map((p) => p.userId) } })
      .select("fullName email")
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json(patients.map((p) => ({ ...p, user: byId.get(String(p.userId)) })));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/diagnoses/recent", async (req, res, next) => {
  try {
    const diagnoses = await Diagnosis.find({ tenantId: req.auth!.tenantId }).sort({ createdAt: -1 }).limit(50);
    res.json(diagnoses);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/audit-events", async (req, res, next) => {
  try {
    const events = await AuditEvent.find({ tenantId: req.auth!.tenantId }).sort({ createdAt: -1 }).limit(200).lean();
    const actors = await User.find({ tenantId: req.auth!.tenantId, _id: { $in: events.map((e) => e.actorId) } })
      .select("fullName email")
      .lean();
    const byId = new Map(actors.map((u) => [String(u._id), u]));
    res.json(
      events.map((event) => ({
        ...event,
        actorName: byId.get(String(event.actorId))?.fullName,
        actorEmail: byId.get(String(event.actorId))?.email,
      }))
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/subscription", async (req, res, next) => {
  try {
    const subscription = await getSubscriptionWithUsage(req.auth!.tenantId);
    res.json(subscription);
  } catch (err) {
    next(err);
  }
});
