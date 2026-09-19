export type Role = "ADMIN" | "DOCTOR" | "PATIENT";

export type RiskColor = "green" | "yellow" | "red";

export interface OrganSignal {
  organ: string;
  severity: "low" | "moderate" | "high";
  color: RiskColor;
  explanation: string;
  evidenceRecordIds: string[];
  missingData: string[];
}

export interface TreatmentAnalysisResult {
  analysisStatus: "queued" | "processing" | "completed" | "failed" | "stale" | "needs_doctor_review";
  overallRisk: RiskColor;
  signals: OrganSignal[];
  affectedOrgans: string[];
  projection: { horizonDays: number; label: "scenario_projection"; confidence: "limited" | "moderate" | "high" };
  disclaimer: string;
}
