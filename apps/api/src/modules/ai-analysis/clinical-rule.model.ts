import { Schema, model, Types } from "mongoose";
import type { RiskColor } from "../../shared/types";

export interface ClinicalRuleDoc {
  _id: Types.ObjectId;
  ruleSetVersion: string;
  code: string;
  description: string;
  appliesToDiagnosisLabels: string[];
  appliesToMedicationNames: string[];
  requiredFields: string[];
  organsAffected: string[];
  severity: RiskColor;
  explanationTemplate: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clinicalRuleSchema = new Schema<ClinicalRuleDoc>(
  {
    ruleSetVersion: { type: String, required: true, index: true },
    code: { type: String, required: true },
    description: { type: String, required: true },
    appliesToDiagnosisLabels: [{ type: String }],
    appliesToMedicationNames: [{ type: String }],
    requiredFields: [{ type: String }],
    organsAffected: [{ type: String }],
    severity: { type: String, enum: ["green", "yellow", "red"], required: true },
    explanationTemplate: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clinicalRuleSchema.index({ ruleSetVersion: 1, code: 1 }, { unique: true });

export const ClinicalRule = model<ClinicalRuleDoc>("ClinicalRule", clinicalRuleSchema);
