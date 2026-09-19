import crypto from "node:crypto";
import { z } from "zod";
import { HttpError } from "../../middleware/errorHandler";
import { callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import { PatientProfile } from "../patients/patient.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { buildChainMap, type ChainMap, type ChainSnapshot } from "./chain-engine";
import { fallbackGuidance } from "./chain-fallback";

const PROMPT_VERSION = "chronic-chains@1";
const CACHE_TTL_MS = 60 * 60 * 1000;
/** An AI-down answer is held only long enough to stop a retry storm. */
const DEGRADED_TTL_MS = 2 * 60 * 1000;

/** What the model writes for one link. The link itself comes from the catalog. */
export interface ChainGuidance {
  code: string;
  /** The mechanism reworded for a reader. Never a new mechanism. */
  explanation: string;
  /** Actions that slow or watch this chain. Behaviour, checks, appointments. */
  doThis: string[];
  /** What makes this chain worse, or what to stop doing. Never a medicine. */
  avoidThis: string[];
  /** Symptoms that mean contact the clinic rather than wait. */
  seeDoctorIf: string[];
  /**
   * Message keys, present only on the catalog fallback. Model-written guidance
   * is already in the language the page asked for and has nothing to look up;
   * the fallback is fixed English, so it travels as keys instead.
   */
  explanationKey?: string;
  doThisKeys?: string[];
  avoidThisKeys?: string[];
  seeDoctorIfKeys?: string[];
}

export interface ChainReport extends ChainMap {
  patientCode: string;
  language: string;
  intro?: string;
  guidance: ChainGuidance[];
  /** Who wrote the guidance: the model, or the reviewed stage-level fallback. */
  guidanceSource: "model" | "catalog_fallback";
  ai: { available: boolean; modelId?: string; error?: string };
  disclaimer: string;
}

const GUIDANCE_SCHEMA = z.object({
  intro: z.string().default(""),
  guidance: z
    .array(
      z.object({
        code: z.string(),
        explanation: z.string().min(1),
        doThis: z.array(z.string()).max(6).default([]),
        avoidThis: z.array(z.string()).max(6).default([]),
        seeDoctorIf: z.array(z.string()).max(6).default([]),
      })
    )
    .default([]),
});

const DISCLAIMER =
  "Chain links come from a reviewed clinical catalog; the wording inside each one is AI-generated and unverified. " +
  "This is decision support, not a diagnosis or a prescription.";

// The same map is fetched every time the tab is opened; the wording only needs
// regenerating when the patient's verified record changes. This also keeps
// free-tier requests down.
const cache = new Map<string, { at: number; report: ChainReport }>();

/**
 * The chronic-disease chain map for one patient: which of their conditions can
 * lead on to which others, how far along their own record says each chain is,
 * and what to do and avoid for each.
 *
 * The split is the point. Which chains exist, and the stage each is at, are
 * decided by the deterministic catalog and engine over verified data only. What
 * to do about each one is written by the model, inside hard limits: it may not
 * name a medicine, a dose or a target, and it may not add or drop a link. A
 * doctor reads it as an AI interpretation, which is how the UI labels it.
 */
export async function getChainReportForPatient(params: {
  tenantId: string;
  patientId: string;
  language?: string;
}): Promise<ChainReport> {
  const profile = await PatientProfile.findOne({ _id: params.patientId, tenantId: params.tenantId });
  if (!profile) throw new HttpError(404, "Patient not found");

  const [diagnoses, labRecords] = await Promise.all([
    Diagnosis.find({ tenantId: params.tenantId, patientId: profile._id }).lean(),
    MedicalRecord.find({ tenantId: params.tenantId, patientId: profile._id, type: "lab_result" })
      .sort({ eventDate: -1 })
      .limit(50)
      .lean(),
  ]);

  const labValues: Record<string, number | undefined> = {};
  const labUnits: Record<string, string | undefined> = {};
  for (const record of labRecords) {
    // An AI-extracted value a doctor has not approved is not a fact, and must
    // not put this patient on a disease chain.
    if (record.verificationStatus === "ai_unverified" || record.verificationStatus === "rejected") continue;
    const data = record.data as Record<string, unknown>;
    const field = typeof data.field === "string" ? data.field : undefined;
    const value = typeof data.value === "number" ? data.value : undefined;
    // Records are newest-first, so the first value seen for a field wins.
    if (field && value !== undefined && labValues[field] === undefined) {
      labValues[field] = value;
      labUnits[field] = typeof data.unit === "string" ? data.unit : undefined;
    }
  }

  const snapshot: ChainSnapshot = {
    diagnosisLabels: diagnoses.map((d) => d.label),
    labValues,
    labUnits,
  };
  const map = buildChainMap(snapshot);
  const language = params.language ?? "en";

  const base: ChainReport = {
    ...map,
    patientCode: profile.patientCode,
    language,
    guidance: [],
    guidanceSource: "catalog_fallback",
    ai: { available: false },
    disclaimer: DISCLAIMER,
  };

  if (map.chains.length === 0) return base;

  const key = crypto
    .createHash("sha256")
    .update(JSON.stringify({ chains: map.chains, language, promptVersion: PROMPT_VERSION }))
    .digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.report, generatedAt: map.generatedAt };

  const result = await callGeminiStructured({
    systemPrompt:
      `You write practical management notes for a doctor about chronic-disease progression chains, in ${languageName(language)}. ` +
      "You are given a fixed list of links, each with a code, the condition it starts from, what it can lead to, how far along this patient is, and the reviewed mechanism. " +
      "Write one entry per link, in the same order, keeping each link's code exactly. Never add a link, never drop one, never change what a link says it leads to. " +
      "HARD LIMITS: never name any medicine or drug class, never state a dose, never state a numeric threshold, target or cut-off value, and never tell anyone to start, stop or change a treatment. " +
      "Name the category of a test or check rather than its cut-off. " +
      "doThis and avoidThis must be behaviour, checks, measurements or appointments only. " +
      "Write each item as one short imperative sentence. Give 2 to 4 items per list. " +
      "Match the depth to the stage: an established link needs management and monitoring, a risk link needs prevention. " +
      'Return strict JSON: {"intro": string, "guidance": [{"code": string, "explanation": string, "doThis": string[], "avoidThis": string[], "seeDoctorIf": string[]}]}.',
    userPrompt: JSON.stringify({
      stageMeanings: {
        established: "the destination condition is already recorded for this patient",
        early: "a reading shows this chain has started moving",
        risk: "the starting condition is present but no reading shows movement yet",
      },
      links: map.chains.map((chain) => ({
        code: chain.code,
        from: chain.from,
        leadsTo: chain.to,
        organ: chain.organ,
        stage: chain.stage,
        mechanism: chain.mechanism,
        whyThisPatient: chain.because,
      })),
      readingsNotOnFile: map.missingData,
    }),
    schema: GUIDANCE_SCHEMA,
    promptVersion: PROMPT_VERSION,
    tenantId: params.tenantId,
    temperature: 0.3,
  });

  if (!result.ok || !result.data) {
    // The map stands on its own — links, stages and mechanisms are catalog
    // facts and do not need the model. Rather than leaving a doctor with no
    // advice at all, stage-level reviewed guidance fills in, labelled as such.
    const degraded: ChainReport = {
      ...base,
      guidance: fallbackGuidance(map.chains),
      guidanceSource: "catalog_fallback",
      ai: { available: false, error: result.error ?? "AI unavailable" },
    };
    // Cache the AI-down answer too, briefly. Without this every reopen of the
    // tab spends another request against an allowance that is already gone,
    // which is what keeps a quota outage from ever clearing.
    cache.set(key, { at: Date.now() - (CACHE_TTL_MS - DEGRADED_TTL_MS), report: degraded });
    return degraded;
  }

  // Anything returned for a code that is not in this patient's map is dropped.
  const known = new Set(map.chains.map((chain) => chain.code));
  const report: ChainReport = {
    ...base,
    intro: result.data.intro || undefined,
    guidance: (result.data.guidance ?? [])
      .filter((entry) => known.has(entry.code))
      .map((entry) => ({
        code: entry.code,
        explanation: entry.explanation,
        doThis: entry.doThis ?? [],
        avoidThis: entry.avoidThis ?? [],
        seeDoctorIf: entry.seeDoctorIf ?? [],
      })),
    guidanceSource: "model",
    ai: { available: true, modelId: result.modelId },
  };

  cache.set(key, { at: Date.now(), report });
  return report;
}
