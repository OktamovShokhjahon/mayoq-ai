import crypto from "node:crypto";
import { z } from "zod";
import { HttpError } from "../../middleware/errorHandler";
import { PatientProfile } from "../patients/patient.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";
import { Allergy } from "../medications/allergy.model";
import { MedicalRecord } from "../medical-records/medical-record.model";
import { TreatmentScenario, type OrganSignal } from "../ai-analysis/treatment-scenario.model";
import { callGeminiGrounded, callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import { deepStrings, type DeepStrings } from "./deep-strings";
import { RULE_SET_VERSION } from "../ai-analysis/rule-catalog";
import { getDrugReference } from "../drug-reference/drug-reference.service";
import { TREND_SPECS, analyseSeries, type SeriesPoint, type TrendResult } from "./trend-engine";

/**
 * Deep analysis: one pass over everything the system holds about a patient,
 * plus what the public medicine databases and the medical literature say.
 *
 * Layering, from most to least trustworthy:
 *   1. the patient's verified readings and the deterministic rules over them;
 *   2. a fitted trend and a projection band (arithmetic, labelled projection);
 *   3. drug labels from public databases;
 *   4. literature found by web search, with its sources;
 *   5. a model's wording that ties the above together.
 * Each reasoning step carries its grade, so a reader can tell a measurement
 * from a search result from a model's reading of one.
 */

const PROMPT_VERSION = "deep-analysis@1";
const CACHE_TTL_MS = 30 * 60 * 1000;

export type Audience = "doctor" | "patient";
export type Grade = "verified" | "clinical_rule" | "projection" | "ai_interpretation";
export type StepKind = "data" | "trend" | "forecast" | "rule" | "literature" | "conclusion";

export interface ChainStep {
  id: string;
  kind: StepKind;
  title: string;
  detail: string;
  grade: Grade;
  /** Organs this step speaks for; the twin highlights them when it is chosen. */
  organs: string[];
  /** Record ids or source URLs behind the step. */
  refs: string[];
  /**
   * Rule steps only. The rest of this report is composed in the language that
   * was asked for, but a rule sentence belongs to the rule catalog, which the
   * console translates from its own dictionary — so that half travels as a key
   * and the console reassembles the step. `detail` remains the fallback.
   */
  explanationKey?: string;
  explanationVars?: Record<string, string | number>;
  monitoringKey?: string;
  observed?: Array<{ field: string; label: string; value: number; unit?: string }>;
}

/** One line of why an organ is on the list, with the key behind it when it has one. */
export interface OrganReason {
  text: string;
  key?: string;
  vars?: Record<string, string | number>;
}

export interface OrganFinding {
  organ: string;
  /** A rule's colour. Null when no rule has assessed the organ: colour is never inferred from a trend. */
  color: "green" | "yellow" | "red" | null;
  /** Written in the requested language, except rule lines — see `reasonDetails`. */
  reasons: string[];
  /** The same lines, each carrying the message key the console can translate. */
  reasonDetails: OrganReason[];
  missing: string[];
  /** True when a trend, not a rule, is what draws attention here. */
  watch: boolean;
}

export interface DeepAnalysisReport {
  audience: Audience;
  language: string;
  generatedAt: string;
  patientCode: string;
  headline: { text: string; source: "model" | "rules" };
  overallRisk: "green" | "yellow" | "red" | null;
  /** What "everything" covered, so the reader can see how deep the search went. */
  coverage: {
    readings: number;
    measurements: number;
    diagnoses: number;
    medications: number;
    allergies: number;
    scenarios: number;
    excludedUnverified: number;
    drugLabels: number;
    literatureSources: number;
    ruleSetVersion: string;
  };
  organs: OrganFinding[];
  /** Signals for the digital twin, in the shape it already renders. */
  twinSignals: Array<{
    organ: string;
    severity: "low" | "moderate" | "high";
    color: "green" | "yellow" | "red";
    explanation: string;
    missingData: string[];
    evidence: Grade;
  }>;
  trends: TrendResult[];
  chain: ChainStep[];
  prognosis: { narrative: string; source: "model" | "rules"; horizonDays: number };
  reasoning?: string;
  literature: {
    searched: boolean;
    summary?: string;
    sources: Array<{ title: string; url: string }>;
    queries: string[];
    error?: string;
  };
  /** Doctors only. */
  drugNotes: Array<{ drug: string; summary: string; sources: Array<{ name: string; url: string }>; notice: string }>;
  considerations: string[];
  /** Patients only: lifestyle and follow-up wording that never touches medication. */
  patientNotes: string[];
  missingData: string[];
  ai: { available: boolean; modelId?: string; error?: string };
  disclaimer: string;
}

const SYNTHESIS_SCHEMA = z.object({
  headline: z.string().min(1),
  reasoning: z.string().min(1),
  prognosis: z.string().min(1),
  literatureSummary: z.string().default(""),
  considerations: z.array(z.string()).default([]),
  patientNotes: z.array(z.string()).default([]),
});

const cache = new Map<string, { at: number; report: DeepAnalysisReport }>();

function ageBand(dob?: Date): string | undefined {
  if (!dob) return undefined;
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000));
  if (!Number.isFinite(years) || years < 0) return undefined;
  const low = Math.floor(years / 10) * 10;
  return `${low}-${low + 9}`;
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Gathers the verified evidence. Nothing an unapproved extraction produced gets past here. */
async function gather(tenantId: string, patientId: string, audience: Audience) {
  const profile = await PatientProfile.findOne({ _id: patientId, tenantId });
  if (!profile) throw new HttpError(404, "Patient not found");

  const scenarioFilter: Record<string, unknown> = { tenantId, patientId: profile._id };
  // A patient only ever reads scenarios their doctor has approved and published.
  if (audience === "patient") {
    scenarioFilter.status = "APPROVED";
    scenarioFilter["doctorReview.visibleToPatient"] = true;
    scenarioFilter["patientSummary.approved"] = true;
  }

  const [diagnoses, medications, allergies, records, scenarios] = await Promise.all([
    Diagnosis.find({ tenantId, patientId: profile._id }).lean(),
    Medication.find({ tenantId, patientId: profile._id, status: "active" }).lean(),
    Allergy.find({ tenantId, patientId: profile._id }).lean(),
    MedicalRecord.find({
      tenantId,
      patientId: profile._id,
      type: { $in: ["lab_result", "vital_sign"] },
      archivedAt: { $exists: false },
    })
      .sort({ eventDate: 1 })
      .limit(400)
      .lean(),
    TreatmentScenario.find(scenarioFilter).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  let excludedUnverified = 0;
  const byField = new Map<string, SeriesPoint[]>();
  let readings = 0;
  for (const record of records) {
    if (record.verificationStatus === "ai_unverified" || record.verificationStatus === "rejected") {
      excludedUnverified += 1;
      continue;
    }
    const data = record.data as Record<string, unknown>;
    const field = typeof data.field === "string" ? data.field : undefined;
    const value = typeof data.value === "number" ? data.value : undefined;
    if (!field || value === undefined) continue;
    readings += 1;
    byField.set(field, [
      ...(byField.get(field) ?? []),
      { date: new Date(record.eventDate).toISOString(), value, recordId: String(record._id) },
    ]);
  }

  return { profile, diagnoses, medications, allergies, scenarios, byField, readings, excludedUnverified };
}

const COLOR_RANK = { green: 1, yellow: 2, red: 3 } as const;

function organFindings(
  signals: OrganSignal[],
  trends: TrendResult[],
  missingByOrgan: Map<string, string[]>,
  strings: DeepStrings
): OrganFinding[] {
  const map = new Map<string, OrganFinding>();
  const get = (organ: string): OrganFinding => {
    let entry = map.get(organ);
    if (!entry) {
      entry = { organ, color: null, reasons: [], reasonDetails: [], missing: [], watch: false };
      map.set(organ, entry);
    }
    return entry;
  };

  for (const signal of signals) {
    const entry = get(signal.organ);
    if (!entry.color || COLOR_RANK[signal.color] > COLOR_RANK[entry.color]) entry.color = signal.color;
    entry.reasonDetails.push({
      text: signal.explanation,
      key: signal.explanationKey,
      vars: signal.explanationVars,
    });
    entry.missing.push(...signal.missingData);
  }
  for (const trend of trends) {
    if (trend.targetStatus === "at_target" && trend.direction !== "worsening") continue;
    for (const organ of trend.organs) {
      const entry = get(organ);
      entry.watch = true;
      entry.reasonDetails.push({
        text: strings.organReason(
          trend.label,
          fmt(trend.latest.value),
          trend.unit,
          trend.targetStatus === "off_target" ? fmt(trend.target) : undefined,
          trend.direction ? strings.direction[trend.direction] : undefined
        ),
      });
    }
  }
  for (const [organ, missing] of missingByOrgan) get(organ).missing.push(...missing);

  return [...map.values()]
    .map((entry) => {
      // Deduplicated on the text: two rules can reach the same organ with the
      // same sentence, and a doctor should read it once.
      const seen = new Set<string>();
      const reasonDetails = entry.reasonDetails.filter((reason) => !seen.has(reason.text) && seen.add(reason.text));
      return {
        ...entry,
        reasonDetails,
        reasons: reasonDetails.map((reason) => reason.text),
        missing: [...new Set(entry.missing)],
      };
    })
    .sort((a, b) => (COLOR_RANK[b.color ?? "green"] ?? 0) - (COLOR_RANK[a.color ?? "green"] ?? 0));
}

function buildChain(params: {
  readings: number;
  measurements: number;
  excludedUnverified: number;
  trends: TrendResult[];
  signals: OrganSignal[];
  strings: DeepStrings;
}): ChainStep[] {
  const { strings } = params;
  const chain: ChainStep[] = [];
  chain.push({
    id: "data",
    kind: "data",
    title: strings.chain.verifiedRecord,
    detail:
      strings.chain.record(params.readings, params.measurements) +
      (params.excludedUnverified > 0 ? strings.chain.excluded(params.excludedUnverified) : ""),
    grade: "verified",
    organs: [],
    refs: [],
  });

  for (const trend of params.trends) {
    const first = trend.points[0];
    const moved =
      trend.points.length > 1
        ? strings.chain.trendMoved(trend.label, fmt(first.value), fmt(trend.latest.value), trend.unit, trend.points.length)
        : strings.chain.trendSingle(trend.label, fmt(trend.latest.value), trend.unit);
    chain.push({
      id: `trend:${trend.field}`,
      kind: "trend",
      title: strings.chain.trendTitle(trend.label, trend.direction ? strings.direction[trend.direction] : undefined),
      detail:
        moved +
        strings.chain.trendTarget(trend.better, fmt(trend.target), trend.targetStatus === "at_target") +
        (trend.slopePer30d !== undefined
          ? strings.chain.trendSlope(`${trend.slopePer30d > 0 ? "+" : ""}${fmt(trend.slopePer30d)}`)
          : ""),
      grade: "verified",
      organs: trend.organs,
      refs: trend.points.map((p) => p.recordId).filter((x): x is string => Boolean(x)),
    });
    if (trend.forecast) {
      const far = trend.forecast[trend.forecast.length - 1];
      chain.push({
        id: `forecast:${trend.field}`,
        kind: "forecast",
        title: strings.chain.forecastTitle(trend.label, far.day),
        detail:
          strings.chain.forecastDetail(fmt(far.expected), trend.unit, fmt(far.low), fmt(far.high)) +
          (trend.daysToTarget
            ? strings.chain.forecastReaches(trend.daysToTarget)
            : trend.targetStatus === "off_target"
              ? strings.chain.forecastNeverReaches
              : "") +
          (trend.caveat ? ` ${trend.caveat}` : ""),
        grade: "projection",
        organs: trend.organs,
        refs: [],
      });
    }
  }

  for (const signal of params.signals) {
    chain.push({
      id: `rule:${signal.ruleCode ?? signal.organ}`,
      kind: "rule",
      title: strings.chain.ruleTitle(signal.organ.replace(/_/g, " "), signal.color),
      // The rule's own sentence travels with its message key, so the console
      // renders that half in the reader's language rather than this one.
      detail:
        signal.explanation +
        (signal.observed?.length
          ? strings.chain.ruleRead(
              signal.observed.map((o) => `${o.label} ${fmt(o.value)}${o.unit ? " " + o.unit : ""}`).join(", ")
            )
          : "") +
        (signal.monitoring ? ` ${signal.monitoring}` : ""),
      explanationKey: signal.explanationKey,
      explanationVars: signal.explanationVars,
      monitoringKey: signal.monitoringKey,
      observed: signal.observed,
      grade: "clinical_rule",
      organs: [signal.organ],
      refs: signal.evidenceRecordIds ?? [],
    });
  }
  return chain;
}

/** Deterministic fallback wording, used whole when the model is unreachable. */
function rulesHeadline(trends: TrendResult[], organs: OrganFinding[], strings: DeepStrings): string {
  const attention = organs.filter((o) => o.color === "red" || o.color === "yellow");
  const worsening = trends.filter((t) => t.direction === "worsening");
  const improving = trends.filter((t) => t.direction === "improving");
  const parts: string[] = [];
  if (attention.length) parts.push(strings.rules.organsFlagged(attention.length));
  if (worsening.length) parts.push(strings.rules.worsening(worsening.map((t) => t.label).join(", ")));
  if (improving.length) parts.push(strings.rules.improving(improving.map((t) => t.label).join(", ")));
  return parts.length ? parts.join("; ") + "." : strings.rules.nothingFlagged;
}

function rulesPrognosis(trends: TrendResult[], strings: DeepStrings): string {
  const withForecast = trends.filter((t) => t.forecast);
  if (!withForecast.length) return strings.rules.noForecast;
  return withForecast
    .map((t) => {
      const far = t.forecast![t.forecast!.length - 1];
      return strings.rules.prognosisLine(t.label, fmt(far.expected), t.unit, far.day, fmt(far.low), fmt(far.high));
    })
    .join(" ");
}

async function searchLiterature(params: {
  audience: Audience;
  language?: string;
  tenantId: string;
  ageBand?: string;
  sex?: string;
  diagnoses: string[];
  medications: string[];
  trends: TrendResult[];
}) {
  // De-identified on purpose. This query leaves the system: it carries a
  // decade of age, sex, conditions, generic drug names and the shape of the
  // trends, and nothing that could name the patient.
  const facts = {
    ageBand: params.ageBand,
    sex: params.sex,
    conditions: params.diagnoses,
    medications: params.medications,
    trends: params.trends.map((t) => ({
      measure: t.label,
      latest: `${fmt(t.latest.value)} ${t.unit}`,
      direction: t.direction ?? "unknown",
      target: `${t.better === "lower" ? "≤" : "≥"} ${fmt(t.target)}`,
    })),
  };
  const audienceLine =
    params.audience === "doctor"
      ? "The reader is a physician. Summarise current guideline targets, expected course with this profile, relevant drug-safety cautions and monitoring intervals."
      : "The reader is the patient. Explain in plain words what guidelines say about the outlook and about lifestyle habits that help. Do not advise starting, stopping or changing any medicine.";
  return callGeminiGrounded({
    tenantId: params.tenantId,
    systemPrompt:
      "You research clinical guidelines and peer-reviewed literature. Search, then write a concise, factual brief of at most 250 words. " +
      "Prefer guidelines and systematic reviews from recognised bodies. State the guideline or study behind each claim. " +
      "If the evidence is mixed or thin, say so. Never invent a citation or a number. " +
      audienceLine +
      ` Write in ${languageName(params.language)}.`,
    userPrompt: `De-identified case:\n${JSON.stringify(facts)}\n\nFind and summarise what current guidelines and literature say about this profile and its likely course.`,
  });
}

export async function runDeepAnalysis(params: {
  tenantId: string;
  patientId: string;
  audience: Audience;
  language?: string;
  refresh?: boolean;
}): Promise<DeepAnalysisReport> {
  const { tenantId, patientId, audience, language } = params;
  const strings = deepStrings(language);
  const data = await gather(tenantId, patientId, audience);

  const trends = TREND_SPECS.map((spec) => analyseSeries(spec, data.byField.get(spec.field) ?? [], strings)).filter(
    (t): t is TrendResult => Boolean(t)
  );
  const latestScenario = data.scenarios[0];
  const signals: OrganSignal[] = latestScenario?.signals ?? [];

  const cacheKey = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        tenantId,
        patientId,
        audience,
        language,
        readings: data.readings,
        latest: [...data.byField.entries()].map(([k, v]) => [k, v.length, v[v.length - 1]?.date]),
        scenario: latestScenario ? String(latestScenario._id) + String(latestScenario.updatedAt) : null,
        meds: data.medications.map((m) => String(m._id)),
      })
    )
    .digest("hex");
  const hit = cache.get(cacheKey);
  if (!params.refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.report;

  // Fields a diagnosis usually implies but the record does not hold.
  const missingByOrgan = new Map<string, string[]>();
  const labels = data.diagnoses.map((d) => d.label);
  const has = (re: RegExp) => labels.some((l) => re.test(l));
  // Recorded as the field name, like every other missing value in the report:
  // the console labels them all from one dictionary.
  const need = (field: string, organ: string) => {
    if (!data.byField.has(field)) missingByOrgan.set(organ, [...(missingByOrgan.get(organ) ?? []), field]);
  };
  if (has(/diabet/i)) {
    need("latestHba1c", "pancreas");
    need("latestEgfr", "kidney");
  }
  if (has(/hypertens/i)) need("latestSystolicBp", "heart");

  const organs = organFindings(signals, trends, missingByOrgan, strings);
  const missingData = [
    ...new Set([...(latestScenario?.missingData ?? []), ...[...missingByOrgan.values()].flat()]),
  ];
  const chain = buildChain({
    readings: data.readings,
    measurements: data.byField.size,
    excludedUnverified: data.excludedUnverified,
    trends,
    signals,
    strings,
  });

  // Deep search: drug labels (doctors) and literature (both), in parallel.
  const drugNames = [...new Set(data.medications.map((m) => m.genericName))].slice(0, 4);
  const [drugResults, literature] = await Promise.all([
    audience === "doctor"
      ? Promise.allSettled(drugNames.map((name) => getDrugReference(name, language)))
      : Promise.resolve([] as PromiseSettledResult<Awaited<ReturnType<typeof getDrugReference>>>[]),
    labels.length
      ? searchLiterature({
          audience,
          language,
          tenantId,
          ageBand: ageBand(data.profile.dateOfBirth),
          sex: data.profile.sex,
          diagnoses: labels,
          medications: audience === "doctor" ? drugNames : [],
          trends,
        })
      : Promise.resolve(undefined),
  ]);

  const drugNotes: DeepAnalysisReport["drugNotes"] = [];
  drugResults.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value.found) return;
    drugNotes.push({
      drug: result.value.genericName ?? drugNames[index],
      summary: result.value.plainSummary ?? result.value.sections[0]?.text.slice(0, 400) ?? "",
      sources: result.value.sources,
      notice: result.value.notice,
    });
  });

  const literatureOk = Boolean(literature?.ok && literature.text);
  if (literatureOk) {
    chain.push({
      id: "literature",
      kind: "literature",
      title: strings.chain.literatureTitle,
      detail: strings.chain.literatureDetail,
      grade: "ai_interpretation",
      organs: [],
      refs: literature!.sources.map((s) => s.url),
    });
  }

  // Synthesis: the model ties the layers together. It receives numbers it may
  // quote and is told not to introduce others.
  const synthesis = await callGeminiStructured({
    tenantId,
    promptVersion: PROMPT_VERSION,
    temperature: 0.2,
    schema: SYNTHESIS_SCHEMA,
    systemPrompt:
      "You are a clinical decision-support writer. You are given a patient's verified findings, deterministic rule results, fitted trends with projection bands, drug label notes and a literature brief. " +
      "Write ONLY from that input. Never introduce a number, threshold, drug, dose, diagnosis or citation that is not in it. " +
      "Keep measured facts, rule results, projections and literature clearly distinct, and say which one you are relying on. " +
      "If the literature brief disagrees with a rule or a trend, say so plainly. If data is missing, name it and do not guess. " +
      "Fields: headline (one sentence, 25 words max); reasoning (one paragraph, 140 words max, connecting the evidence to the conclusion); " +
      "prognosis (90 words max: the likely course over the next 90 days, framed as a projection with its uncertainty); " +
      "literatureSummary (60 words max, or empty if no brief was given). " +
      (audience === "doctor"
        ? "considerations: up to 4 short items the physician may want to weigh (monitoring, missing tests, interactions). Phrase them as questions or options for the physician, never as orders. patientNotes must be an empty array. "
        : "patientNotes: up to 4 short, kind, plain-language items about habits and follow-up. Never mention starting, stopping or changing any medicine; say to ask the care team. considerations must be an empty array. ") +
      `Write in ${languageName(language)}. Return strict JSON.`,
    userPrompt: JSON.stringify({
      audience,
      conditions: labels,
      trends: trends.map((t) => ({
        measure: t.label,
        unit: t.unit,
        readings: t.points.map((p) => ({ date: p.date.slice(0, 10), value: p.value })),
        target: t.target,
        better: t.better,
        direction: t.direction,
        status: t.targetStatus,
        forecast: t.forecast,
        daysToTarget: t.daysToTarget,
        caveat: t.caveat,
      })),
      ruleResults: signals.map((s) => ({ organ: s.organ, color: s.color, explanation: s.explanation, observed: s.observed })),
      missingData,
      drugNotes: drugNotes.map((d) => ({ drug: d.drug, note: d.summary.slice(0, 500) })),
      allergies: data.allergies.map((a) => a.substance),
      literatureBrief: literatureOk ? literature!.text!.slice(0, 3500) : null,
    }),
  });

  const ai = synthesis.ok && synthesis.data ? synthesis.data : undefined;
  const overallRisk =
    signals.length > 0
      ? signals.reduce<"green" | "yellow" | "red">(
          (worst, s) => (COLOR_RANK[s.color] > COLOR_RANK[worst] ? s.color : worst),
          "green"
        )
      : null;

  if (ai?.reasoning) {
    chain.push({
      id: "conclusion",
      kind: "conclusion",
      title: strings.chain.conclusionTitle,
      detail: ai.reasoning,
      grade: "ai_interpretation",
      organs: [],
      refs: [],
    });
  }

  const report: DeepAnalysisReport = {
    audience,
    language: language ?? "en",
    generatedAt: new Date().toISOString(),
    patientCode: data.profile.patientCode,
    headline: ai ? { text: ai.headline, source: "model" } : { text: rulesHeadline(trends, organs, strings), source: "rules" },
    overallRisk,
    coverage: {
      readings: data.readings,
      measurements: data.byField.size,
      diagnoses: data.diagnoses.length,
      medications: data.medications.length,
      allergies: data.allergies.length,
      scenarios: data.scenarios.length,
      excludedUnverified: data.excludedUnverified,
      drugLabels: drugNotes.length,
      literatureSources: literatureOk ? literature!.sources.length : 0,
      ruleSetVersion: RULE_SET_VERSION,
    },
    organs,
    twinSignals: signals.map((s) => ({
      organ: s.organ,
      severity: s.severity,
      color: s.color,
      explanation: s.explanation,
      explanationKey: s.explanationKey,
      explanationVars: s.explanationVars,
      missingData: s.missingData,
      evidence: "clinical_rule" as const,
    })),
    trends,
    chain,
    prognosis: ai
      ? { narrative: ai.prognosis, source: "model", horizonDays: 90 }
      : { narrative: rulesPrognosis(trends, strings), source: "rules", horizonDays: 90 },
    reasoning: ai?.reasoning,
    literature: {
      searched: labels.length > 0,
      summary: ai?.literatureSummary || undefined,
      sources: literatureOk ? literature!.sources : [],
      queries: literatureOk ? literature!.searchQueries : [],
      error: labels.length === 0 ? strings.noDiagnosisToSearch : literatureOk ? undefined : literature?.error,
    },
    drugNotes,
    considerations: audience === "doctor" ? ai?.considerations ?? [] : [],
    patientNotes: audience === "patient" ? ai?.patientNotes ?? [] : [],
    missingData,
    ai: { available: Boolean(ai), modelId: synthesis.modelId, error: ai ? undefined : synthesis.error },
    disclaimer: strings.disclaimer,
  };

  cache.set(cacheKey, { at: Date.now(), report });
  return report;
}
