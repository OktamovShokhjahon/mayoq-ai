"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  Check,
  ExternalLink,
  FileSearch,
  Loader2,
  Microscope,
  Pill,
  ScanSearch,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { DEEP_COPY } from "@/lib/deep-analysis-copy";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { BodyDiagram } from "@/components/digital-twin/body-diagram";
import { OrganLabels, type Projection } from "@/components/digital-twin/organ-labels";
import { STATE_GLYPH, STATE_HEX, organLabelKey, type Sex } from "@/components/digital-twin/anatomy";
import type { EvidenceGrade, OrganSignal } from "@/components/digital-twin/types";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { fieldLabel, fieldList, formatDateTime } from "@/lib/format";
import { useClinicalText } from "@/lib/clinical-text";

/* ------------------------------------------------------------------ types */

interface Point {
  date: string;
  value: number;
}
interface ForecastPoint {
  day: number;
  date: string;
  expected: number;
  low: number;
  high: number;
}
interface Trend {
  field: string;
  label: string;
  unit: string;
  target: number;
  better: "lower" | "higher";
  organs: string[];
  points: Point[];
  latest: Point;
  targetStatus: "at_target" | "off_target";
  direction?: "improving" | "worsening" | "stable";
  daysToTarget?: number;
  forecast?: ForecastPoint[];
  confidence: "insufficient" | "limited" | "moderate";
  caveat?: string;
}
interface ChainStep {
  id: string;
  kind: string;
  title: string;
  detail: string;
  grade: EvidenceGrade;
  organs: string[];
  refs: string[];
  /**
   * Rule steps only. The report is composed in the language that was asked
   * for, but a rule's own sentence belongs to the catalog, which this console
   * translates — so that half arrives as a key and the step is put back
   * together here.
   */
  explanationKey?: string;
  explanationVars?: Record<string, string | number>;
  monitoringKey?: string;
  observed?: Array<{ field: string; label?: string; value: number; unit?: string }>;
}
/** One line of why an organ is listed, with the key behind it where there is one. */
interface ReasonLine {
  text: string;
  key?: string;
  vars?: Record<string, string | number>;
}

interface OrganFinding {
  organ: string;
  color: "green" | "yellow" | "red" | null;
  reasons: string[];
  /** The same lines, each with the message key behind it where there is one. */
  reasonDetails?: ReasonLine[];
  missing: string[];
  watch: boolean;
}
export interface DeepReport {
  audience: "doctor" | "patient";
  generatedAt: string;
  patientCode: string;
  headline: { text: string; source: "model" | "rules" };
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
  twinSignals: OrganSignal[];
  trends: Trend[];
  chain: ChainStep[];
  prognosis: { narrative: string; source: "model" | "rules"; horizonDays: number };
  literature: {
    searched: boolean;
    summary?: string;
    sources: Array<{ title: string; url: string }>;
    queries: string[];
    error?: string;
  };
  drugNotes: Array<{ drug: string; summary: string; sources: Array<{ name: string; url: string }>; notice: string }>;
  considerations: string[];
  patientNotes: string[];
  missingData: string[];
  ai: { available: boolean; modelId?: string; error?: string };
}

const BodyScene = dynamic(() => import("@/components/digital-twin/body-scene").then((m) => m.BodyScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ink/[0.035]" />,
});

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

const STAGE_ICONS = [FileSearch, TrendingUp, Pill, BookOpen, Sparkles];

/* ------------------------------------------------------------------ panel */

/**
 * One-click deep analysis. The button runs the server-side pass; while it works
 * the stages tick over so the wait is legible, and when it returns the report
 * is laid out in the order a reader needs it: verdict, where it shows on the
 * body, the numbers behind it, then the reasoning and the evidence.
 */
export function DeepAnalysis({
  endpoint,
  audience,
  sex = "neutral",
}: {
  endpoint: string;
  audience: "doctor" | "patient";
  sex?: Sex;
}) {
  const { locale } = useI18n();
  const copy = DEEP_COPY[locale];

  // A query that only runs on demand: the result then survives a tab switch,
  // and the server's own cache makes a repeat click cheap.
  // "Run again" asks the server to skip its cache; the first run does not.
  const refreshNext = useRef(false);
  const query = useQuery({
    queryKey: ["deep-analysis", endpoint, locale],
    queryFn: () => {
      const refresh = refreshNext.current;
      refreshNext.current = false;
      return api.post<DeepReport>(endpoint, { language: locale, refresh });
    },
    enabled: false,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  const report = query.data;
  const running = query.isFetching;

  const run = () => {
    refreshNext.current = Boolean(report);
    void query.refetch();
  };

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] p-6">
        <div className="max-w-2xl">
          <span className="readout inline-flex items-center gap-2">
            <ScanSearch className="h-3.5 w-3.5" aria-hidden /> {copy.eyebrow}
          </span>
          <h2 className="display mt-2 text-[22px] leading-snug text-ink">{copy.title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{copy.intro[audience]}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {copy.scope.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted"
                style={{ borderColor: "var(--line)" }}
              >
                <Check className="h-3 w-3 text-signal" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 disabled:translate-y-0 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Microscope className="h-4 w-4" aria-hidden />}
            {report ? copy.rerun : copy.run}
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{copy.estimate}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {running && <Progress key="progress" stages={copy.stages} />}
      </AnimatePresence>

      {!running && query.isError && (
        <div role="alert" className="border-b border-[color:var(--line)] p-6">
          <h3 className="display text-[16px] text-state-red">{copy.errorTitle}</h3>
          <p className="mt-1 max-w-readable text-[14px] text-ink-muted">
            {query.error instanceof ApiError ? query.error.message : String((query.error as Error)?.message ?? "")}
          </p>
          <button
            type="button"
            onClick={() => run()}
            className="mt-3 rounded border px-3 py-1.5 text-sm text-ink transition hover:bg-ink/[0.04]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            {copy.retry}
          </button>
        </div>
      )}

      {!running && report && <Report report={report} sex={sex} />}
    </section>
  );
}

/* --------------------------------------------------------------- progress */

function Progress({ stages }: { stages: string[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    // The server does not stream progress, so this paces itself and holds on
    // the last stage. It shows the work being done, not measured completion.
    const timer = setInterval(() => setActive((n) => Math.min(n + 1, stages.length - 1)), 5500);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <motion.ol
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
      className="grid gap-3 p-6 sm:grid-cols-5"
    >
      {stages.map((stage, index) => {
        const Icon = STAGE_ICONS[index] ?? Sparkles;
        const done = index < active;
        const current = index === active;
        return (
          <li
            key={stage}
            className={`flex items-center gap-3 rounded border p-3 text-[13px] transition sm:flex-col sm:items-start ${
              current ? "text-ink" : done ? "text-ink-muted" : "text-ink-faint"
            }`}
            style={{ borderColor: current ? "var(--signal)" : "var(--line)" }}
          >
            {done ? (
              <Check className="h-4 w-4 text-state-green" aria-hidden />
            ) : current ? (
              <Loader2 className="h-4 w-4 animate-spin text-signal" aria-hidden />
            ) : (
              <Icon className="h-4 w-4" aria-hidden />
            )}
            {stage}
          </li>
        );
      })}
    </motion.ol>
  );
}

/** Reports written before the keys existed carry only the sentences. */
function reasonLines(finding: OrganFinding): ReasonLine[] {
  return finding.reasonDetails ?? finding.reasons.map((text) => ({ text }));
}

/* ----------------------------------------------------------------- report */

function Report({ report, sex }: { report: DeepReport; sex: Sex }) {
  const { t, locale } = useI18n();
  const copy = DEEP_COPY[locale];
  const text = useClinicalText();

  /**
   * A reasoning step, said in this language.
   *
   * Every other step arrives already written in the language that was asked
   * for. A rule step is the exception: its first sentence is the rule
   * catalog's, which lives in these dictionaries, so the step is put back
   * together from the key, the values it read, and the follow-up note.
   */
  const stepDetail = (step: ChainStep) => {
    if (!step.explanationKey) return step.detail;
    const read = step.observed?.length
      ? " " +
        t("deep.read", {
          values: step.observed
            .map((entry) => `${fieldLabel(entry.field)} ${entry.value}${entry.unit ? " " + entry.unit : ""}`)
            .join(", "),
        })
      : "";
    const monitoring = step.monitoringKey ? " " + text(step.monitoringKey, "") : "";
    return text(step.explanationKey, step.detail, step.explanationVars) + read + monitoring;
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const chooseOrgan = (organ: string | null) => {
    setSelected(organ);
    setActiveStep(null);
  };
  const chooseStep = (step: ChainStep) => {
    const next = activeStep === step.id ? null : step.id;
    setActiveStep(next);
    setSelected(next ? step.organs[0] ?? null : null);
  };

  const { coverage } = report;
  const stats: Array<[string, number]> = [
    [copy.coverage.readings, coverage.readings],
    [copy.coverage.diagnoses, coverage.diagnoses],
    ...(report.audience === "doctor"
      ? ([
          [copy.coverage.medications, coverage.medications],
          [copy.coverage.drugLabels, coverage.drugLabels],
        ] as Array<[string, number]>)
      : []),
    [copy.coverage.sources, coverage.literatureSources],
  ];

  return (
    <div className="flex flex-col">
      {/* Verdict */}
      <div className="border-b border-[color:var(--line)] bg-paper-deep/40 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ProvenanceChip grade={report.headline.source === "model" ? "ai_interpretation" : "clinical_rule"} />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {report.headline.source === "model" ? copy.sourceModel : copy.sourceRules} · {report.patientCode}
          </span>
        </div>
        <p className="display mt-3 max-w-3xl text-[22px] leading-snug text-ink">{report.headline.text}</p>
        {!report.ai.available && (
          <p className="mt-3 max-w-readable rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2 text-[13px] text-ink-muted">
            {copy.rulesOnly}
          </p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="readout">{label}</dt>
              <dd className="readout-value mt-0.5 text-[18px] text-ink">{value}</dd>
            </div>
          ))}
          {coverage.excludedUnverified > 0 && (
            <div title={copy.excludedHint}>
              <dt className="readout">{copy.coverage.excluded}</dt>
              <dd className="readout-value mt-0.5 text-[18px] text-state-amber">{coverage.excludedUnverified}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Twin + organs */}
      <div className="grid gap-0 border-b border-[color:var(--line)] lg:grid-cols-[1.1fr_1fr]">
        <div className="border-b border-[color:var(--line)] lg:border-b-0 lg:border-r">
          <TwinFocus report={report} sex={sex} selected={selected} onSelect={chooseOrgan} />
        </div>
        <div className="p-6">
          <h3 className="readout">{copy.organsTitle}</h3>
          <p className="mt-1 text-[12px] text-ink-faint">{copy.twinHint}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {report.organs.length === 0 && <li className="text-[13px] text-ink-muted">{copy.notAssessed}</li>}
            {report.organs.map((finding) => {
              const active = selected === finding.organ;
              const hex = finding.color ? STATE_HEX[finding.color] : "var(--line-strong)";
              return (
                <li key={finding.organ}>
                  <button
                    type="button"
                    onClick={() => chooseOrgan(active ? null : finding.organ)}
                    aria-pressed={active}
                    className={`w-full rounded border p-3 text-left transition ${active ? "bg-ink/[0.04]" : "hover:bg-ink/[0.025]"}`}
                    style={{ borderColor: active ? hex : "var(--line)", borderLeft: `3px solid ${hex}` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium text-ink">
                        {t(organLabelKey(finding.organ))}
                      </span>
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: finding.color ? hex : "var(--ink-faint)" }}
                      >
                        {finding.color ? `${STATE_GLYPH[finding.color]} ${copy.ruleAssessed}` : finding.watch ? copy.watchByTrend : copy.notAssessed}
                      </span>
                    </div>
                    {reasonLines(finding)
                      .slice(0, 3)
                      .map((reason) => (
                        <p key={reason.text} className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                          {text(reason.key, reason.text, reason.vars)}
                        </p>
                      ))}
                    {finding.missing.length > 0 && (
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-state-amber">
                        {copy.missing}: {fieldList(finding.missing)}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Trends */}
      {report.trends.length > 0 && (
        <div className="border-b border-[color:var(--line)] p-6">
          <h3 className="readout">{copy.trendsTitle}</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {report.trends.map((trend) => (
              <TrendChart key={trend.field} trend={trend} />
            ))}
          </div>
        </div>
      )}

      {/* Prognosis */}
      <div className="border-b border-[color:var(--line)] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="readout">{copy.prognosisTitle}</h3>
          <ProvenanceChip grade="projection" />
        </div>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink">{report.prognosis.narrative}</p>
        {report.trends.some((tr) => tr.forecast) && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color:var(--line-strong)]">
                  <th scope="col" className="py-2 pr-4" />
                  {[30, 60, 90].map((d) => (
                    <th key={d} scope="col" className="readout py-2 pr-4">
                      {copy.day} {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.trends
                  .filter((tr) => tr.forecast)
                  .map((tr) => (
                    <tr key={tr.field} className="border-b border-[color:var(--line)]">
                      <th scope="row" className="py-2.5 pr-4 text-[13px] font-medium text-ink">
                        {tr.label}
                      </th>
                      {[30, 60, 90].map((day) => {
                        // A horizon the history is too short to reach is left out
                        // by the API, and shown here as a dash rather than guessed.
                        const f = tr.forecast!.find((x) => x.day === day);
                        return (
                          <td key={day} className="readout-value py-2.5 pr-4 text-[13px] text-ink-muted">
                            {f ? (
                              <>
                                <span className="text-ink">{f.expected}</span>{" "}
                                <span className="text-ink-faint">
                                  ({f.low}–{f.high})
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reasoning chain */}
      <div className="border-b border-[color:var(--line)] p-6">
        <h3 className="readout">{copy.chainTitle}</h3>
        <p className="mt-1 text-[12px] text-ink-faint">{copy.chainHint}</p>
        {/* The steps are ordered: record, then trend, then rule, then conclusion. */}
        <ol className="mt-5 border-l pl-6" style={{ borderColor: "var(--line-strong)" }}>
          {report.chain.map((step) => {
            const active = activeStep === step.id;
            const clickable = step.organs.length > 0;
            return (
              <li key={step.id} className="relative pb-5 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface"
                  style={{ background: active ? "var(--lamp)" : "var(--signal)" }}
                />
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => chooseStep(step)}
                  aria-pressed={clickable ? active : undefined}
                  className={`block w-full rounded text-left ${clickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium capitalize text-ink">{step.title}</span>
                    <ProvenanceChip grade={step.grade} />
                  </div>
                  <p className={`mt-1 max-w-3xl text-[13.5px] leading-relaxed ${active ? "text-ink" : "text-ink-muted"}`}>
                    {stepDetail(step)}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Literature + drugs */}
      <div className="grid gap-0 border-b border-[color:var(--line)] lg:grid-cols-2">
        <div className="border-b border-[color:var(--line)] p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-signal" aria-hidden />
            <h3 className="readout">{copy.literatureTitle}</h3>
          </div>
          {report.literature.summary ? (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{report.literature.summary}</p>
          ) : (
            <p className="mt-3 text-[13px] text-ink-faint">
              {report.literature.error ?? copy.literatureNone}
            </p>
          )}
          {report.literature.sources.length > 0 && (
            <>
              <span className="readout mt-4 block">{copy.sourcesLabel}</span>
              <ul className="mt-2 flex flex-col gap-1.5">
                {report.literature.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-start gap-1.5 text-[13px] text-signal underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="mt-[3px] h-3 w-3 shrink-0" aria-hidden />
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.literature.queries.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                {copy.queriesLabel} ({report.literature.queries.length})
              </summary>
              <ul className="mt-2 list-disc pl-5 text-[12px] text-ink-muted">
                {report.literature.queries.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="p-6">
          {report.audience === "doctor" ? (
            <>
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-signal" aria-hidden />
                <h3 className="readout">{copy.drugsTitle}</h3>
              </div>
              <ul className="mt-3 flex flex-col gap-4">
                {report.drugNotes.map((drug) => (
                  <li key={drug.drug}>
                    <div className="text-[14px] font-medium capitalize text-ink">{drug.drug}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{drug.summary}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3">
                      {drug.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11px] text-signal hover:underline"
                        >
                          {source.name}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
                {report.drugNotes.length === 0 && <li className="text-[13px] text-ink-faint">—</li>}
              </ul>
            </>
          ) : null}
          {report.considerations.length > 0 && (
            <>
              <h3 className="readout mt-6 first:mt-0">{copy.considerationsTitle}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {report.considerations.map((item) => (
                  <li key={item} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-muted">
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.patientNotes.length > 0 && (
            <>
              <h3 className="readout">{copy.notesTitle}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {report.patientNotes.map((item) => (
                  <li key={item} className="flex gap-2 text-[14px] leading-relaxed text-ink-muted">
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {report.missingData.length > 0 && (
        <div className="border-b border-[color:var(--line)] p-6">
          <h3 className="readout">{copy.missingTitle}</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {report.missingData.map((item) => (
              <li
                key={item}
                className="rounded border border-state-amber/40 bg-state-amber/10 px-2.5 py-1 font-mono text-[11px] text-ink-muted"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 p-6">
        <p className="max-w-readable text-[12px] leading-relaxed text-ink-faint">{copy.disclaimer}</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          {copy.generated} {formatDateTime(report.generatedAt)}
          {report.ai.modelId ? ` · ${report.ai.modelId}` : ""} · {report.coverage.ruleSetVersion}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- twin */

function TwinFocus({
  report,
  sex,
  selected,
  onSelect,
}: {
  report: DeepReport;
  sex: Sex;
  selected: string | null;
  onSelect: (organ: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const copy = DEEP_COPY[locale];
  const reduced = usePrefersReducedMotion();
  const [supported, setSupported] = useState<boolean | null>(null);
  const projection = useRef<Projection>({});

  useEffect(() => {
    setSupported(detectWebGL());
  }, []);

  // The twin is a dark stage in both themes, so it needs the rule signals only:
  // organs a trend flagged but no rule assessed stay neutral, and the focus ring
  // comes from `selected`. Colour on this body always means a rule said so.
  const signals = useMemo(
    () =>
      report.twinSignals.map((signal) => ({
        ...signal,
        explanation: signal.explanation,
      })),
    [report.twinSignals],
  );

  return (
    <div className="relative overflow-hidden bg-[color:var(--console)]">
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
        <span className="readout !text-white/55">{copy.twinTitle}</span>
        {selected && (
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#5fd4e6]">
            {t(organLabelKey(selected))}
          </span>
        )}
      </div>
      <div className="h-[460px] w-full sm:h-[540px]">
        {supported === null ? (
          <div className="h-full w-full animate-pulse bg-ink/[0.035]" />
        ) : supported ? (
          <BodyScene
            beforeSignals={signals}
            afterSignals={signals}
            mix={0}
            view="front"
            sex={sex}
            projection={projection}
            autoRotate
            reducedMotion={reduced}
            selectedOrgan={selected}
            onSelectOrgan={onSelect}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <BodyDiagram signals={signals} selectedOrgan={selected} onSelectOrgan={onSelect} />
          </div>
        )}
      </div>
      {supported && (
        <OrganLabels signals={signals} projection={projection} selectedOrgan={selected} onSelectOrgan={onSelect} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ chart */

function TrendChart({ trend }: { trend: Trend }) {
  const { locale } = useI18n();
  const copy = DEEP_COPY[locale];

  const { data, lastTs, endTs, domain } = useMemo(() => {
    const rows: Array<{ ts: number; value?: number; expected?: number; band?: [number, number] }> = trend.points.map(
      (p) => ({ ts: new Date(p.date).getTime(), value: p.value }),
    );
    const last = rows[rows.length - 1];
    if (trend.forecast) {
      // The projection starts from the last measured point, so the two lines join.
      last.expected = last.value;
      last.band = [last.value as number, last.value as number];
      for (const f of trend.forecast) {
        rows.push({ ts: new Date(f.date).getTime(), expected: f.expected, band: [f.low, f.high] });
      }
    }
    const values = rows.flatMap((r) => [r.value, r.expected, ...(r.band ?? [])]).filter((v): v is number => typeof v === "number");
    values.push(trend.target);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.12, 0.2);
    return {
      data: rows,
      lastTs: last.ts,
      endTs: rows[rows.length - 1].ts,
      domain: [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10] as [number, number],
    };
  }, [trend]);

  const good = trend.direction === "improving" || (trend.direction === "stable" && trend.targetStatus === "at_target");
  const directionColor =
    trend.direction === "worsening" ? "var(--state-red)" : good ? "var(--state-green)" : "var(--ink-muted)";
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(locale === "uz" ? "uz-Latn" : locale, { month: "short", day: "numeric" });

  return (
    <figure className="rounded-lg border p-4" style={{ borderColor: "var(--line)" }}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium text-ink">
          {trend.label} <span className="font-mono text-[11px] text-ink-faint">{trend.unit}</span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em]">
          {trend.direction && <span style={{ color: directionColor }}>{copy.direction[trend.direction]}</span>}
          <span className={trend.targetStatus === "at_target" ? "text-state-green" : "text-state-amber"}>
            {trend.targetStatus === "at_target" ? copy.atTarget : copy.offTarget}
          </span>
        </span>
      </figcaption>

      <div className="mt-3 h-[230px] w-full" role="img" aria-label={`${trend.label}: ${copy.measured}, ${copy.projection}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtDate}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
              minTickGap={28}
            />
            <YAxis
              domain={domain}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 10, fill: "var(--ink-faint)" }}
            />
            {trend.forecast && (
              <ReferenceArea
                x1={lastTs}
                x2={endTs}
                fill="var(--signal)"
                fillOpacity={0.05}
                label={{ value: copy.projection, position: "insideTopRight", fontSize: 10, fill: "var(--ink-faint)" }}
              />
            )}
            <ReferenceLine
              y={trend.target}
              stroke="var(--state-amber)"
              strokeDasharray="4 4"
              label={{ value: `${copy.target} ${trend.target}`, position: "insideBottomLeft", fontSize: 10, fill: "var(--state-amber)" }}
            />
            <Tooltip
              labelFormatter={(ts: number) => fmtDate(ts)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line-strong)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--ink)",
              }}
              formatter={(value: number | [number, number], name: string) => [
                Array.isArray(value) ? `${value[0]} – ${value[1]}` : value,
                name === "band" ? copy.band : name === "expected" ? copy.expected : copy.measured,
              ]}
            />
            <Area
              dataKey="band"
              type="monotone"
              stroke="none"
              fill="var(--signal)"
              fillOpacity={0.16}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              dataKey="expected"
              type="monotone"
              stroke="var(--signal)"
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--surface)", stroke: "var(--signal)", strokeWidth: 1.5 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--ink)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "var(--ink)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-ink" /> {copy.measured}
        </span>
        {trend.forecast && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--signal)" }} />{" "}
              {copy.expected}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-4" style={{ background: "var(--signal)", opacity: 0.25 }} /> {copy.band}
            </span>
          </>
        )}
        {trend.daysToTarget && <span className="text-signal">{copy.daysToTarget.replace("{n}", String(trend.daysToTarget))}</span>}
      </div>
      {trend.caveat && <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{trend.caveat}</p>}
    </figure>
  );
}
