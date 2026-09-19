"use client";

import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { RiskBadge } from "@/components/ui/risk-badge";
import { fieldLabel, fieldList } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { signalExplanation, signalMonitoring, useClinicalText } from "@/lib/clinical-text";
import { ORGAN_BY_KEY, organLabelKey } from "@/components/digital-twin/anatomy";
import type { OrganSignal } from "@/components/digital-twin/types";
import type { MessageKey } from "@/lib/locales/uz";

export interface AnalysisNarrative {
  aiNarrative?: string;
  /** The window the analysis covers, for restating a rule summary. */
  horizonDays?: number;
  /** Worst rule severity, as a level rather than a colour. */
  overallRiskLevel?: "low" | "moderate" | "high";
  narrativeSource?: "model" | "rule_summary";
  aiAvailable?: boolean;
  aiError?: string;
  missingData: string[];
  signals: OrganSignal[];
  ruleSetVersion: string;
  modelId: string;
}

/**
 * What the rules found, in words, with the values they read. The twin shows
 * *where*; this shows *why*, and keeps the two things the spec insists on
 * separating visibly apart: a deterministic rule result, and whatever wrote the
 * paragraph underneath it.
 */
export function AnalysisFindings({ analysis }: { analysis: AnalysisNarrative }) {
  const { t } = useI18n();
  const text = useClinicalText();

  /** Registry name where there is one, the raw key spaced out where there is not. */
  const organLabel = (organ: string) =>
    ORGAN_BY_KEY[organ] ? t(organLabelKey(organ)) : organ.replace(/_/g, " ");

  /**
   * The rule summary, said again in this language.
   *
   * When the model is unreachable the API restates the rule result in
   * sentences. Those sentences are English, but everything they restate is on
   * this page already and already translated, so the summary is rebuilt here
   * rather than printed as it arrived — otherwise the one paragraph a doctor
   * reads when the AI is down is the one paragraph in the wrong language.
   */
  const ruleSummary = () => {
    const organs = [...new Set(analysis.signals.map((signal) => organLabel(signal.organ)))];
    const lines = [
      organs.length > 0
        ? t("scenario.ruleSummary.flagged", {
            days: analysis.horizonDays ?? 0,
            organs: organs.join(", "),
            risk: t(`severity.${analysis.overallRiskLevel ?? "low"}` as MessageKey),
          })
        : t("scenario.ruleSummary.none", { days: analysis.horizonDays ?? 0 }),
      ...new Set(analysis.signals.map((signal) => signalExplanation(text, signal))),
    ];
    if (analysis.missingData.length > 0) {
      lines.push(t("scenario.ruleSummary.missing", { list: fieldList(analysis.missingData) }));
    }
    return lines.join(" ");
  };

  // One rule can raise a signal per organ; the explanation is what varies.
  const findings = Array.from(
    analysis.signals.reduce((map, signal) => {
      const key = signal.ruleCode ?? signal.explanation;
      const existing = map.get(key);
      if (existing) {
        existing.organs.push(signal.organ);
      } else {
        map.set(key, { signal, organs: [signal.organ] });
      }
      return map;
    }, new Map<string, { signal: OrganSignal; organs: string[] }>()),
  ).map(([, value]) => value);

  return (
    <div className="flex flex-col gap-4">
      {analysis.missingData.length > 0 && (
        <p
          role="status"
          className="rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2.5 text-[13px] leading-relaxed text-state-amber"
        >
          <span aria-hidden>△ </span>
          {t("af.incomplete", { fields: fieldList(analysis.missingData) })}
        </p>
      )}

      {findings.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {findings.map(({ signal, organs }, index) => (
            <li
              key={`${signal.ruleCode ?? index}`}
              className="rounded border bg-surface p-4"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-ink">
                    {organs.map(organLabel).join(" · ")}
                  </span>
                  <ProvenanceChip grade="clinical_rule" />
                </div>
                <RiskBadge color={signal.color} quiet />
              </div>

              <p className="mt-2 max-w-readable text-[13px] leading-relaxed text-ink-muted">
                {signalExplanation(text, signal)}
              </p>

              {signal.observed && signal.observed.length > 0 && (
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
                  {signal.observed.map((entry) => (
                    <div key={entry.field} className="flex flex-col">
                      <dt className="readout">{entry.label ?? fieldLabel(entry.field)}</dt>
                      <dd className="font-mono text-[13px] tabular-nums text-ink">
                        {entry.value}
                        {entry.unit ? ` ${entry.unit}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {signal.missingData && signal.missingData.length > 0 && (
                <p className="mt-2.5 font-mono text-[11px] text-state-amber">
                  {t("af.notOnFile", { fields: fieldList(signal.missingData) })}
                </p>
              )}

              {signalMonitoring(text, signal) && (
                <p className="mt-2.5 border-l-2 pl-3 text-[12px] leading-relaxed text-ink-muted" style={{ borderColor: "var(--signal)" }}>
                  {signalMonitoring(text, signal)}
                </p>
              )}

              {signal.ruleCode && (
                <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                  {t("af.ruleSet", { code: signal.ruleCode, version: analysis.ruleSetVersion })}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-state-green/40 bg-state-green/10 px-3 py-2.5 text-[13px] text-state-green">
          <span aria-hidden>✓ </span>
          {t("af.noRule", { version: analysis.ruleSetVersion })}
        </p>
      )}

      {/* The explanation layer, always labelled with who wrote it. */}
      {analysis.aiNarrative && (
        <div
          className="rounded border p-4"
          style={{
            borderColor: analysis.aiAvailable ? "color-mix(in srgb, var(--ai) 35%, transparent)" : "var(--line)",
            background: analysis.aiAvailable
              ? "linear-gradient(135deg, color-mix(in srgb, var(--ai) 7%, transparent), transparent 70%)"
              : "var(--sunken)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {analysis.aiAvailable ? (
              <ProvenanceChip grade="ai_interpretation" />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-[color:var(--line-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
                {t("af.ruleSummary")}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {analysis.aiAvailable ? analysis.modelId : t("af.noModelOutput")}
            </span>
          </div>
          <p className="mt-2.5 max-w-readable text-[13px] leading-relaxed text-ink">
            {analysis.narrativeSource === "rule_summary" ? ruleSummary() : analysis.aiNarrative}
          </p>
          {!analysis.aiAvailable && (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              {t("af.modelUnavailable")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
