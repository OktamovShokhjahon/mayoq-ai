import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { TreatmentScenario } from "../ai-analysis/treatment-scenario.model";
import { PatientProfile } from "../patients/patient.model";
import { AIJob } from "../ai-analysis/ai-job.model";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireRole("ADMIN", "DOCTOR"));

analyticsRouter.get("/overview", async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const [byRisk, byStatus, aiJobStats] = await Promise.all([
      TreatmentScenario.aggregate([{ $match: { tenantId: new Types.ObjectId(req.auth!.tenantId) } }, { $group: { _id: "$overallRisk", count: { $sum: 1 } } }]),
      PatientProfile.aggregate([{ $match: { tenantId: new Types.ObjectId(req.auth!.tenantId) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      AIJob.aggregate([{ $match: { tenantId: new Types.ObjectId(req.auth!.tenantId) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    res.json({ tenantId, byRisk, byStatus, aiJobStats });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/trends", async (req, res, next) => {
  try {
    const trends = await TreatmentScenario.aggregate([
      { $match: { tenantId: new Types.ObjectId(req.auth!.tenantId) } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          redCount: { $sum: { $cond: [{ $eq: ["$overallRisk", "red"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 90 },
    ]);
    res.json(trends);
  } catch (err) {
    next(err);
  }
});
