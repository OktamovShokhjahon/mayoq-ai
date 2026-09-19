import { Schema, model, Types } from "mongoose";
import type { AnalysisStatus, TreatmentDecisionState } from "../../shared/types";

export interface OrganSignal {
  type: "organ_risk";
  organ: string;
  severity: "low" | "moderate" | "high";
  color: "green" | "yellow" | "red";
  explanation: string;
  /**
   * Message key for `explanation`, and the values it interpolates. The console
   * renders the key so a stored analysis follows the reader's language switch;
   * `explanation` above is the English fallback for anything the dictionary
   * has not caught up with, and for analyses written before the keys existed.
   */
  explanationKey?: string;
  explanationVars?: Record<string, string | number>;
  evidenceRecordIds: string[];
  missingData: string[];
  /** The values the rule actually read, so the finding can be checked. */
  observed?: Array<{ field: string; label: string; value: number; unit?: string }>;
  /** Deterministic follow-up note from the catalog, never model-written. */
  monitoring?: string;
  /** Message key for `monitoring`, for the same reason. */
  monitoringKey?: string;
  ruleCode?: string;
}

export interface TreatmentScenarioDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  diagnosisIds: Types.ObjectId[];
  medicationIds: Types.ObjectId[];
  baselineSnapshotHash: string;
  analysisStatus: AnalysisStatus;
  overallRisk: "green" | "yellow" | "red";
  signals: OrganSignal[];
  affectedOrgans: string[];
  missingData: string[];
  horizonDays: number;
  /** The window the doctor chose for this projection. */
  projectionFrom: Date;
  projectionTo: Date;
  projectionLabel: "scenario_projection";
  confidence: "limited" | "moderate" | "high";
  modelId: string;
  promptVersion: string;
  ruleSetVersion: string;
  /** Plain-language explanation of the rule result, written by the model. */
  aiNarrative?: string;
  /** Who wrote the narrative: the model, or a restatement of the rule output. */
  narrativeSource?: "model" | "rule_summary";
  /** False when the model was unreachable: the rule result still stands alone. */
  /** Plain-language version for the patient. Hidden until a doctor approves it. */
  patientSummary?: {
    text: string;
    modelId: string;
    generatedAt: Date;
    approved: boolean;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
  };
  aiAvailable: boolean;
  aiError?: string;
  disclaimer: string;
  status: TreatmentDecisionState;
  doctorReview?: {
    reviewedBy: Types.ObjectId;
    reviewedAt: Date;
    decision: TreatmentDecisionState;
    note?: string;
    visibleToPatient: boolean;
  };
  recalculationRequired: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const treatmentScenarioSchema = new Schema<TreatmentScenarioDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    diagnosisIds: [{ type: Schema.Types.ObjectId, ref: "Diagnosis" }],
    medicationIds: [{ type: Schema.Types.ObjectId, ref: "Medication" }],
    baselineSnapshotHash: { type: String, required: true },
    analysisStatus: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "stale", "needs_doctor_review"],
      default: "queued",
    },
    overallRisk: { type: String, enum: ["green", "yellow", "red"], default: "yellow" },
    signals: [
      {
        type: { type: String, default: "organ_risk" },
        organ: String,
        severity: { type: String, enum: ["low", "moderate", "high"] },
        color: { type: String, enum: ["green", "yellow", "red"] },
        explanation: String,
        explanationKey: String,
        explanationVars: { type: Schema.Types.Mixed },
        evidenceRecordIds: [String],
        missingData: [String],
        observed: [{ field: String, label: String, value: Number, unit: String }],
        monitoring: String,
        monitoringKey: String,
        ruleCode: String,
      },
    ],
    affectedOrgans: [{ type: String }],
    missingData: [{ type: String }],
    horizonDays: { type: Number, default: 30 },
    projectionFrom: { type: Date, required: true },
    projectionTo: { type: Date, required: true },
    projectionLabel: { type: String, default: "scenario_projection" },
    confidence: { type: String, enum: ["limited", "moderate", "high"], default: "limited" },
    modelId: { type: String, required: true },
    promptVersion: { type: String, required: true },
    ruleSetVersion: { type: String, required: true },
    aiNarrative: { type: String },
    narrativeSource: { type: String, enum: ["model", "rule_summary"] },
    patientSummary: {
      text: String,
      modelId: String,
      generatedAt: Date,
      approved: { type: Boolean, default: false },
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      approvedAt: Date,
    },
    aiAvailable: { type: Boolean, default: false },
    aiError: { type: String },
    disclaimer: {
      type: String,
      default: "This is decision support and not a diagnosis or prescription.",
    },
    status: {
      type: String,
      enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISCONTINUED"],
      default: "DRAFT",
    },
    doctorReview: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      decision: { type: String, enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISCONTINUED"] },
      note: String,
      visibleToPatient: { type: Boolean, default: false },
    },
    recalculationRequired: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

treatmentScenarioSchema.index({ tenantId: 1, patientId: 1, createdAt: -1 });

export const TreatmentScenario = model<TreatmentScenarioDoc>("TreatmentScenario", treatmentScenarioSchema);
