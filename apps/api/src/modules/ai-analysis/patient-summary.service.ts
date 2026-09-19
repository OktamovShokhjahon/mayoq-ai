import { z } from "zod";
import { HttpError } from "../../middleware/errorHandler";
import { callGeminiStructured } from "./gemini.client";
import { languageName } from "./language";
import { TreatmentScenario } from "./treatment-scenario.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";

const PROMPT_VERSION = "patient-summary@1";

const SUMMARY_SCHEMA = z.object({ summary: z.string().min(1) });

/**
 * Drafts a plain-language explanation of a scenario for the patient. It is a
 * draft: the patient sees nothing until a doctor has read the text and approved
 * it (spec §9.3, "Yes before patient visibility"). It restates what the doctor
 * and the rules already established and adds no clinical content of its own.
 */
export async function generatePatientSummary(params: { tenantId: string; scenarioId: string; language?: string }) {
  const scenario = await TreatmentScenario.findOne({ _id: params.scenarioId, tenantId: params.tenantId });
  if (!scenario) throw new HttpError(404, "Treatment scenario not found");

  const [diagnoses, medications] = await Promise.all([
    Diagnosis.find({ tenantId: params.tenantId, _id: { $in: scenario.diagnosisIds } }).lean(),
    Medication.find({ tenantId: params.tenantId, _id: { $in: scenario.medicationIds } }).lean(),
  ]);

  const result = await callGeminiStructured({
    systemPrompt:
      "You write a short, calm explanation for a patient of a treatment plan their doctor has reviewed. " +
      "Use plain words at a school reading level, 120 words at most. " +
      "Use ONLY the facts provided. Never add a dose, a threshold, a new medicine, a diagnosis or a prediction that is not in the input. " +
      "Do not tell the patient to start, stop or change any medicine; say to follow the doctor's instructions and ask the care team with questions. " +
      "" + `Write in ${languageName(params.language)}. ` + "Say clearly that the projection is an illustration, not a guarantee. " +
      'Return strict JSON: {"summary": string}.',
    userPrompt: JSON.stringify({
      diagnoses: diagnoses.map((d) => d.label),
      medications: medications.map((m) => ({ name: m.genericName, dosage: m.dosage, unit: m.unit, frequency: m.frequency })),
      organsToMonitor: scenario.affectedOrgans,
      overallRisk: scenario.overallRisk,
      dataStillNeeded: scenario.missingData,
      doctorNote: scenario.doctorReview?.note ?? null,
      projectionDays: scenario.horizonDays,
    }),
    schema: SUMMARY_SCHEMA,
    tenantId: params.tenantId,
    promptVersion: PROMPT_VERSION,
    temperature: 0.3,
  });

  if (!result.ok || !result.data) {
    return { scenario, aiAvailable: false, aiError: result.error ?? "AI unavailable" };
  }

  scenario.patientSummary = {
    text: result.data.summary,
    modelId: result.modelId,
    generatedAt: new Date(),
    approved: false,
  };
  await scenario.save();
  return { scenario, aiAvailable: true };
}

/** The doctor's approval publishes the text they read, edited or not. */
export async function approvePatientSummary(params: {
  tenantId: string;
  scenarioId: string;
  approvedBy: string;
  text?: string;
}) {
  const scenario = await TreatmentScenario.findOne({ _id: params.scenarioId, tenantId: params.tenantId });
  if (!scenario) throw new HttpError(404, "Treatment scenario not found");

  // With the model unavailable a doctor can write the summary themselves; it
  // is recorded as doctor-written, never as model output.
  // Mongoose materialises the nested object because `approved` has a default,
  // so a scenario with no summary still has one. Only text means there is one.
  if (!scenario.patientSummary?.text) {
    if (!params.text?.trim()) throw new HttpError(400, "Write the summary text before approving it");
    scenario.patientSummary = { text: params.text, modelId: "doctor-written", generatedAt: new Date(), approved: false };
  }
  // Words the doctor changed are the doctor's words, not the model's.
  if (params.text && params.text !== scenario.patientSummary.text) {
    scenario.patientSummary.text = params.text;
    scenario.patientSummary.modelId = "doctor-written";
  }
  scenario.patientSummary.approved = true;
  scenario.patientSummary.approvedBy = params.approvedBy as never;
  scenario.patientSummary.approvedAt = new Date();
  await scenario.save();
  return scenario;
}
