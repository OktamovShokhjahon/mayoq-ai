import crypto from "node:crypto";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { Allergy } from "../medications/allergy.model";
import { TreatmentScenario } from "./treatment-scenario.model";
import { runClinicalRules, type PatientSnapshot } from "./rule-engine";
import { callGeminiStructured, NARRATIVE_SCHEMA } from "./gemini.client";
import { AIJob } from "./ai-job.model";
import { RULE_SET_VERSION } from "./rule-catalog";
import { languageName } from "./language";

const PROMPT_VERSION = "treatment-scenario-narrative@1";

/**
 * With the model unreachable the analysis still stands: the rules produced it.
 * This restates that rule output in sentences and nothing else — no judgement,
 * no threshold, no wording of its own. The UI labels it as a rule summary so
 * it is never mistaken for a model explanation.
 */
function ruleSummaryNarrative(result: { signals: { organ: string; explanation: string }[]; missingData: string[]; overallRisk: string }, horizonDays: number): string {
  const organs = [...new Set(result.signals.map((signal) => signal.organ.replace(/_/g, " ")))];
  const lines: string[] = [];
  lines.push(
    organs.length > 0
      ? `Over ${horizonDays} days the rule catalog flags ${organs.join(", ")} for this combination (overall ${result.overallRisk}).`
      : `Over ${horizonDays} days no rule in the catalog flagged this combination.`
  );
  for (const explanation of [...new Set(result.signals.map((signal) => signal.explanation))]) {
    lines.push(explanation);
  }
  if (result.missingData.length > 0) {
    lines.push(`The analysis is incomplete until these are recorded: ${result.missingData.join(", ")}.`);
  }
  return lines.join(" ");
}

export interface CreateTreatmentScenarioInput {
  tenantId: string;
  patientId: string;
  diagnosisIds: string[];
  medicationIds: string[];
  /** Start of the projection window. Defaults to now. */
  projectionFrom?: Date;
  /** End of the projection window, chosen by the doctor. */
  projectionTo: Date;
  createdBy: string;
  /** Interface language, so the explanation is readable by whoever asked for it. */
  language?: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Whole days between the two ends of the window, never less than one. */
export function horizonDaysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
}

async function buildPatientSnapshot(
  tenantId: string,
  patientId: string,
  diagnosisIds: string[],
  medicationIds: string[]
): Promise<PatientSnapshot> {
  const [diagnoses, medications, otherMedications, allergies, labRecords] = await Promise.all([
    Diagnosis.find({ tenantId, _id: { $in: diagnosisIds } }).lean(),
    Medication.find({ tenantId, _id: { $in: medicationIds } }).lean(),
    // Everything else the patient is on: an interaction between the proposed
    // drug and a drug already in the chart is exactly what this is for.
    Medication.find({ tenantId, patientId, _id: { $nin: medicationIds }, status: "active" }).lean(),
    Allergy.find({ tenantId, patientId }).lean(),
    MedicalRecord.find({ tenantId, patientId, type: "lab_result" }).sort({ eventDate: -1 }).limit(50).lean(),
  ]);

  const labValues: Record<string, number | undefined> = {};
  const labUnits: Record<string, string | undefined> = {};
  const evidenceRecordIds: string[] = [];
  for (const record of labRecords) {
    // An AI-extracted value a doctor has not approved is not a fact yet, so it
    // never reaches the rules (spec 5: the verified snapshot only).
    if (record.verificationStatus === "ai_unverified" || record.verificationStatus === "rejected") continue;

    const data = record.data as Record<string, unknown>;
    const fieldName = typeof data.field === "string" ? data.field : undefined;
    const value = typeof data.value === "number" ? data.value : undefined;
    if (fieldName && value !== undefined && labValues[fieldName] === undefined) {
      labValues[fieldName] = value;
      labUnits[fieldName] = typeof data.unit === "string" ? data.unit : undefined;
      evidenceRecordIds.push(String(record._id));
    }
  }

  return {
    diagnosisLabels: diagnoses.map((d) => d.label),
    medicationNames: medications.map((m) => m.genericName),
    existingMedicationNames: otherMedications.map((m) => m.genericName),
    allergySubstances: allergies.map((a) => a.substance),
    labValues,
    labUnits,
    evidenceRecordIds,
  };
}

export async function createTreatmentScenario(input: CreateTreatmentScenarioInput) {
  if (input.diagnosisIds.length === 0 || input.medicationIds.length === 0) {
    throw new HttpError(400, "At least one diagnosis and one medication are required for an analysis");
  }

  const projectionFrom = input.projectionFrom ?? new Date();
  const projectionTo = input.projectionTo;
  if (projectionTo.getTime() <= projectionFrom.getTime()) {
    throw new HttpError(400, "The projection end date must be after the start date");
  }
  const horizonDays = horizonDaysBetween(projectionFrom, projectionTo);

  const snapshot = await buildPatientSnapshot(input.tenantId, input.patientId, input.diagnosisIds, input.medicationIds);
  const ruleResult = runClinicalRules(snapshot);

  const baselineSnapshotHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ snapshot, ruleSetVersion: ruleResult.ruleSetVersion }))
    .digest("hex");

  const aiJob = await AIJob.create({
    tenantId: input.tenantId,
    patientId: input.patientId,
    task: "scenario_narrative",
    status: "processing",
    promptVersion: PROMPT_VERSION,
    modelId: env.geminiModel,
  });

  const aiResult = await callGeminiStructured({
    systemPrompt:
      "You are a clinical explanation assistant. You ONLY explain deterministic rule results already computed by the system. " +
      "Never invent thresholds, drug choices, or contraindications. If information is insufficient, say so. " +
      `Write the narrative in ${languageName(input.language)}; keep drug names, lab names and units as they are. ` +
      'Return strict JSON: {"narrative": string, "confidence": "limited"|"moderate"|"high"}.',
    userPrompt: JSON.stringify({
      diagnoses: snapshot.diagnosisLabels,
      medications: snapshot.medicationNames,
      ruleFindings: ruleResult.signals,
      missingData: ruleResult.missingData,
      horizonDays,
    }),
    schema: NARRATIVE_SCHEMA,
    tenantId: input.tenantId,
    promptVersion: PROMPT_VERSION,
    language: input.language,
  });

  aiJob.status = aiResult.ok ? "completed" : "failed";
  aiJob.latencyMs = aiResult.latencyMs;
  aiJob.responseId = aiResult.responseId;
  aiJob.tokenUsage = aiResult.tokenUsage;
  aiJob.error = aiResult.error;
  aiJob.output = aiResult.data as Record<string, unknown> | undefined;
  await aiJob.save();

  const confidence = aiResult.ok && aiResult.data ? aiResult.data.confidence : "limited";

  const scenario = await TreatmentScenario.create({
    tenantId: input.tenantId,
    patientId: input.patientId,
    diagnosisIds: input.diagnosisIds.map((id) => new Types.ObjectId(id)),
    medicationIds: input.medicationIds.map((id) => new Types.ObjectId(id)),
    baselineSnapshotHash,
    analysisStatus: ruleResult.missingData.length > 0 ? "needs_doctor_review" : "completed",
    overallRisk: ruleResult.overallRisk,
    signals: ruleResult.signals,
    affectedOrgans: ruleResult.affectedOrgans,
    missingData: ruleResult.missingData,
    horizonDays,
    projectionFrom,
    projectionTo,
    confidence,
    // The model that actually answered, so a pre-recorded demo answer is
    // never recorded as live Gemini output.
    modelId: aiResult.modelId,
    promptVersion: PROMPT_VERSION,
    ruleSetVersion: RULE_SET_VERSION,
    // The explanation is stored with the analysis it explains: a doctor
    // reopening the scenario later must see the same words, and must be able
    // to tell a model-written paragraph from a rule result.
    aiNarrative: aiResult.ok ? aiResult.data?.narrative : ruleSummaryNarrative(ruleResult, horizonDays),
    narrativeSource: aiResult.ok ? "model" : "rule_summary",
    aiAvailable: aiResult.ok,
    aiError: aiResult.ok ? undefined : aiResult.error,
    status: "UNDER_REVIEW",
    recalculationRequired: false,
    createdBy: input.createdBy,
  });

  return {
    scenario,
    aiNarrative: aiResult.ok ? aiResult.data?.narrative : ruleSummaryNarrative(ruleResult, horizonDays),
    narrativeSource: aiResult.ok ? "model" : "rule_summary",
    aiAvailable: aiResult.ok,
    aiError: aiResult.ok ? undefined : aiResult.error,
  };
}

export async function markScenarioStale(tenantId: string, patientId: string): Promise<void> {
  await TreatmentScenario.updateMany(
    { tenantId, patientId, status: { $in: ["DRAFT", "UNDER_REVIEW", "APPROVED"] } },
    { $set: { recalculationRequired: true } }
  );
}

export async function reviewScenario(params: {
  tenantId: string;
  scenarioId: string;
  reviewedBy: string;
  decision: "APPROVED" | "REJECTED" | "DISCONTINUED";
  note?: string;
  visibleToPatient: boolean;
}) {
  const scenario = await TreatmentScenario.findOne({ _id: params.scenarioId, tenantId: params.tenantId });
  if (!scenario) throw new HttpError(404, "Treatment scenario not found");

  scenario.status = params.decision;
  scenario.doctorReview = {
    reviewedBy: new Types.ObjectId(params.reviewedBy),
    reviewedAt: new Date(),
    decision: params.decision,
    note: params.note,
    visibleToPatient: params.visibleToPatient,
  };
  await scenario.save();
  return scenario;
}
