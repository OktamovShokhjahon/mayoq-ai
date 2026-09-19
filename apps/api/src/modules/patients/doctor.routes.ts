import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { PatientProfile } from "./patient.model";
import { TreatmentScenario } from "../ai-analysis/treatment-scenario.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { attachPatientIdentity } from "./patient-identity";

export const doctorRouter = Router();
doctorRouter.use(requireAuth, requireRole("DOCTOR"));

doctorRouter.get("/dashboard", async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const doctorId = req.auth!.userId;

    const [assignedPatients, needsReview, newAlerts, missingDataTasks, recentAnalyses] = await Promise.all([
      PatientProfile.countDocuments({ tenantId, assignedDoctorIds: doctorId, status: { $ne: "ARCHIVED" } }),
      PatientProfile.countDocuments({ tenantId, assignedDoctorIds: doctorId, status: "NEEDS_REVIEW" }),
      TreatmentScenario.countDocuments({ tenantId, overallRisk: { $in: ["yellow", "red"] }, status: "UNDER_REVIEW" }),
      MedicalRecord.countDocuments({ tenantId, verificationStatus: "ai_unverified" }),
      TreatmentScenario.find({ tenantId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    res.json({
      assignedPatients,
      needsReview,
      newAlerts,
      missingDataTasks,
      recentAnalyses: await attachPatientIdentity(tenantId, recentAnalyses),
    });
  } catch (err) {
    next(err);
  }
});
