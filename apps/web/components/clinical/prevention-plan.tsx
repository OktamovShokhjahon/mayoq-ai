"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { useClinicalText, type ClinicalText } from "@/lib/clinical-text";
import { fieldList } from "@/lib/format";

export type TimeOfDay = "morning" | "midday" | "evening" | "anytime";

export interface RoutineStep {
  timeOfDay: TimeOfDay;
  action: string;
  detail: string;
  /** Message keys for the two lines above; the English is the fallback. */
  actionKey?: string;
  detailKey?: string;
}

export interface PreventionSuggestion {
  code: string;
  title: string;
  titleKey?: string;
  prevents: string;
  preventsKey?: string;
  because: string;
  becauseKey?: string;
  becauseVars?: Record<string, string | number>;
  routine: RoutineStep[];
  expected: { horizonDays: number; statement: string; measure: string; statementKey?: string; measureKey?: string };
  observed?: { field: string; label: string; value: number; unit?: string };
}

export interface PreventionPlan {
  suggestions: PreventionSuggestion[];
  missingData: string[];
  preventionSetVersion: string;
  generatedAt: string;
  patientCode?: string;
  /** Model-reworded copy of the same suggestions; absent when the model is unavailable. */
  plainLanguage?: { intro: string; items: Array<{ code: string; text: string }>; modelId: string };
}

/** Ordered as a day runs. The sequence is the information. */
const TIME_ORDER: TimeOfDay[] = ["morning", "midday", "evening", "anytime"];

const TIME_KEY = {
  morning: "time.morning",
  midday: "time.midday",
  evening: "time.evening",
  anytime: "time.anytime",
} as const;

function sortRoutine(steps: RoutineStep[]): RoutineStep[] {
  return [...steps].sort(
    (a, b) => TIME_ORDER.indexOf(a.timeOfDay) - TIME_ORDER.indexOf(b.timeOfDay)
  );
}

/**
 * One prevention program: what to do, the day it implies, and what sustained
 * adherence is associated with. The expected result sits in its own band at the
 * bottom because it is the part a patient will re-read, and because it must
 * never be mistaken for something that has already happened.
 */
function ProgramCard({
  suggestion,
  index,
  friendly,
}: {
  suggestion: PreventionSuggestion;
  index: number;
  friendly?: string;
}) {
  const { t } = useI18n();
  const text = useClinicalText();
  const routine = sortRoutine(suggestion.routine);

  return (
    <article className="panel overflow-hidden">
      <div className="border-b border-[color:var(--line)] p-5">
        <div className="flex items-baseline gap-3">
          <span className="readout-value shrink-0 text-[11px] text-ink-faint">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="display text-[17px] leading-snug text-ink">
            {text(suggestion.titleKey, suggestion.title)}
          </h3>
        </div>

        {friendly && (
          <p className="mt-2.5 pl-[30px] text-[14px] leading-relaxed text-ink">
            {friendly}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {t("prevention.aiWording")}
            </span>
          </p>
        )}
        <p className="mt-2.5 pl-[30px] text-[13px] leading-relaxed text-ink-muted">
          {text(suggestion.becauseKey, suggestion.because, suggestion.becauseVars)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[30px]">
          {suggestion.observed && (
            <span
              className="inline-flex items-baseline gap-1.5 rounded border px-2 py-1"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <span className="readout">{fieldList([suggestion.observed.field])}</span>
              <span className="readout-value text-[13px] text-ink">
                {suggestion.observed.value}
                {suggestion.observed.unit ? ` ${suggestion.observed.unit}` : ""}
              </span>
            </span>
          )}
          <span className="text-[12px] leading-snug text-ink-faint">
            {t("prevention.guardsAgainst")} {text(suggestion.preventsKey, suggestion.prevents)}
          </span>
        </div>
      </div>

      {/* The day this implies. */}
      <div className="p-5">
        <span className="readout">{t("prevention.dailyRoutine")}</span>
        <ol className="mt-3 flex flex-col">
          {routine.map((step, stepIndex) => (
            <li
              key={`${step.timeOfDay}-${stepIndex}`}
              className="grid grid-cols-[76px_1fr] gap-x-4 border-t border-[color:var(--line)] py-3 first:border-t-0 first:pt-0 sm:grid-cols-[92px_1fr]"
            >
              <span className="readout pt-0.5">{t(TIME_KEY[step.timeOfDay])}</span>
              <div className="min-w-0">
                <p className="text-[14px] leading-snug text-ink">{text(step.actionKey, step.action)}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
                  {text(step.detailKey, step.detail)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div
        className="border-t p-5"
        style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="readout">{t("prevention.ifYouKeep")}</span>
          <span className="readout-value text-[11px] text-ink-faint">
            {suggestion.expected.horizonDays}d
          </span>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
          {text(suggestion.expected.statementKey, suggestion.expected.statement)}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          {t("prevention.measuredBy")} {text(suggestion.expected.measureKey, suggestion.expected.measure)}
        </p>
      </div>
    </article>
  );
}

function PlanBody({ plan }: { plan: PreventionPlan }) {
  const { t } = useI18n();
  if (plan.suggestions.length === 0) {
    return (
      <div className="panel p-6">
        <p className="text-[14px] leading-relaxed text-ink">
          {t("prevention.none")}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {t("prevention.noneBody")}
        </p>
        {plan.missingData.length > 0 && (
          <p className="mt-3 text-[12px] leading-relaxed text-state-amber">
            {t("prevention.stillMissing")} {fieldList(plan.missingData)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {plan.plainLanguage?.intro && (
        <p className="max-w-readable text-[14px] leading-relaxed text-ink">{plan.plainLanguage.intro}</p>
      )}
      {plan.suggestions.map((suggestion, index) => (
        <ProgramCard
          key={suggestion.code}
          suggestion={suggestion}
          index={index}
          friendly={plan.plainLanguage?.items.find((item) => item.code === suggestion.code)?.text}
        />
      ))}

      {plan.missingData.length > 0 && (
        <div
          className="panel-sunken p-4"
          style={{ borderColor: "rgb(var(--rgb-state-amber) / 0.4)" }}
        >
          <span className="readout text-state-amber">{t("prevention.sharpen")}</span>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {t("prevention.sharpenBody", { list: fieldList(plan.missingData) })}
          </p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink-faint">
        {t("prevention.catalogue", { version: plan.preventionSetVersion })}
      </p>
    </div>
  );
}

/**
 * The patient's prevention plan. This is the one clinical surface a patient
 * sees without a doctor approving it first, which is safe only because the
 * catalogue behind it cannot mention medication — so the banner says plainly
 * what this is and what it is not.
 */
export function PreventionPlanPanel({ endpoint }: { endpoint: string }) {
  const { t, locale } = useI18n();
  const plan = useQuery({
    queryKey: ["prevention-plan", endpoint, locale],
    queryFn: () => api.get<PreventionPlan>(`${endpoint}${endpoint.includes("?") ? "&" : "?"}lang=${locale}`),
  });

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-[20px] leading-tight text-ink">{t("prevention.heading")}</h2>
        <span className="readout">{t("prevention.label")}</span>
      </div>

      <p className="mb-4 max-w-readable text-[13px] leading-relaxed text-ink-muted">
        {t("prevention.intro")}
      </p>

      {plan.isPending && (
        <div className="flex flex-col gap-4">
          <div className="panel h-[280px] animate-pulse" />
          <div className="panel h-[280px] animate-pulse" />
        </div>
      )}

      {plan.isError && (
        <div className="panel p-6">
          <p className="text-[13px] leading-relaxed text-state-red">
            {t("prevention.failed")}
          </p>
        </div>
      )}

      {plan.data && <PlanBody plan={plan.data} />}
    </section>
  );
}
