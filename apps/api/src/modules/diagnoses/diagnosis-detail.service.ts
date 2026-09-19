import { z } from "zod";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import { callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import { Diagnosis } from "./diagnosis.model";

const PROMPT_VERSION = "diagnosis-detail@1";

const DETAIL_SCHEMA = z.object({
  summary: z.string().min(1),
  monitoring: z.array(z.string()).max(8),
  verifyBeforeTreating: z.array(z.string()).max(8),
  redFlags: z.array(z.string()).max(8),
});

/**
 * Expands a diagnosis label a doctor typed into structured clinical context.
 *
 * The model describes *what to look at*, never *what to do*: no numeric
 * thresholds, no drug choices, no dosing. Technical mission §5 forbids the AI
 * inventing those, and this output is stored unverified so it cannot reach the
 * patient snapshot until a doctor approves it.
 */
export async function generateDiagnosisDetail(params: {
  tenantId: string;
  patientId: string;
  diagnosisId: string;
  /** Interface language: this text is read straight off the console. */
  language?: string;
}) {
  const diagnosis = await Diagnosis.findOne({
    _id: params.diagnosisId,
    tenantId: params.tenantId,
    patientId: params.patientId,
  });
  if (!diagnosis) throw new HttpError(404, "Diagnosis not found");

  const result = await callGeminiStructured({
    systemPrompt:
      "You expand a clinical diagnosis label into structured context for a doctor's own review. " +
      "Describe what the condition is, what is usually monitored, what data should be confirmed " +
      "before treating, and what would count as a red flag. " +
      "Hard constraints: never state a numeric threshold, target value, dose or specific drug name. " +
      "Never recommend a treatment. Name the category of a test rather than its cut-off. " +
      "If the label is too vague to expand safely, say so in the summary and return empty arrays. " +
      `Write every string in ${languageName(params.language)}; keep test and drug names as they are. ` +
      'Return strict JSON: {"summary": string, "monitoring": string[], "verifyBeforeTreating": string[], "redFlags": string[]}.',
    userPrompt: JSON.stringify({
      diagnosisLabel: diagnosis.label,
      icdCode: diagnosis.icdCode ?? null,
      doctorNote: diagnosis.doctorNote ?? null,
    }),
    schema: DETAIL_SCHEMA,
    tenantId: params.tenantId,
    promptVersion: PROMPT_VERSION,
    temperature: 0.2,
    language: params.language,
  });

  if (!result.ok || !result.data) {
    return {
      diagnosis,
      aiAvailable: false,
      aiError: result.error ?? "AI unavailable",
    };
  }

  diagnosis.aiDetail = {
    summary: result.data.summary,
    monitoring: result.data.monitoring,
    verifyBeforeTreating: result.data.verifyBeforeTreating,
    redFlags: result.data.redFlags,
    modelId: result.modelId,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date(),
    verificationStatus: "ai_unverified",
  };
  await diagnosis.save();

  return { diagnosis, aiAvailable: true };
}

/** A doctor confirming or rejecting the elaboration. Only they can. */
export async function reviewDiagnosisDetail(params: {
  tenantId: string;
  patientId: string;
  diagnosisId: string;
  reviewedBy: string;
  approve: boolean;
}) {
  const diagnosis = await Diagnosis.findOne({
    _id: params.diagnosisId,
    tenantId: params.tenantId,
    patientId: params.patientId,
  });
  if (!diagnosis) throw new HttpError(404, "Diagnosis not found");
  if (!diagnosis.aiDetail) throw new HttpError(400, "This diagnosis has no AI detail to review");

  diagnosis.aiDetail.verificationStatus = params.approve ? "verified" : "rejected";
  diagnosis.aiDetail.verifiedBy = new Types.ObjectId(params.reviewedBy);
  diagnosis.aiDetail.verifiedAt = new Date();
  await diagnosis.save();

  return diagnosis;
}
