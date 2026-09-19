"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { inputClass } from "@/components/ui/modal";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

export type Decision = "APPROVED" | "REJECTED" | "DISCONTINUED";

export interface ReviewableScenario {
  _id: string;
  status: string;
  recalculationRequired?: boolean;
  overallRisk: "green" | "yellow" | "red";
  patientSummary?: { text: string; modelId: string; approved: boolean };
  doctorReview?: {
    decision: Decision;
    note?: string;
    visibleToPatient: boolean;
    reviewedAt: string;
  };
}

const DECISIONS: Array<{ value: Decision; label: MessageKey; hint: MessageKey; tone: string }> = [
  { value: "APPROVED", label: "sr.approve", hint: "sr.approveHint", tone: "var(--state-green)" },
  { value: "REJECTED", label: "sr.reject", hint: "sr.rejectHint", tone: "var(--state-red)" },
  {
    value: "DISCONTINUED",
    label: "sr.discontinue",
    hint: "sr.discontinueHint",
    tone: "var(--state-amber)",
  },
];

/**
 * The step the analysis exists for. Nothing in MAYOQ AI decides anything: the
 * rules produce a finding, the model puts it into words, and then a named
 * clinician records what they are doing about it. Until that happens the
 * patient sees nothing at all — publishing is a separate, deliberate tick, so
 * an approval for the chart is never silently an approval for the patient.
 */
export function ScenarioReview({
  patientId,
  scenario,
}: {
  patientId: string;
  scenario: ReviewableScenario;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [visibleToPatient, setVisibleToPatient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: () =>
      api.post(`/treatment-scenarios/${scenario._id}/review`, {
        decision,
        note: note.trim() || undefined,
        visibleToPatient: decision === "APPROVED" ? visibleToPatient : false,
      }),
    onSuccess: () => {
      toast(
        decision === "APPROVED" && visibleToPatient
          ? t("sr.recordedPublished")
          : t("sr.recorded")
      );
      setDecision(null);
      setNote("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("sr.saveFailed")),
  });

  const recalculate = useMutation({
    mutationFn: () => api.post(`/treatment-scenarios/${scenario._id}/recalculate`, { language: locale }),
    onSuccess: () => {
      toast(t("sr.reran"));
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("sr.rerunFailed")),
  });

  const [draft, setDraft] = useState<string | null>(null);
  // The API materialises an empty `patientSummary` object; only text counts.
  const summary = scenario.patientSummary?.text ? scenario.patientSummary : undefined;
  const summaryText = draft ?? summary?.text ?? "";

  const generateSummary = useMutation({
    mutationFn: () =>
      api.post<{ aiAvailable: boolean; aiError?: string }>(`/treatment-scenarios/${scenario._id}/patient-summary`, { language: locale }),
    onSuccess: (result) => {
      setDraft(null);
      setError(result.aiAvailable ? null : t("sr.summaryUnavailable"));
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("sr.summaryFailed")),
  });

  const approveSummary = useMutation({
    mutationFn: () =>
      api.post(`/treatment-scenarios/${scenario._id}/patient-summary/approve`, { text: summaryText }),
    onSuccess: () => {
      toast(t("sr.summaryApproved"));
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("sr.summaryFailed")),
  });

  // Mongoose materialises the nested `doctorReview` object because one of its
  // fields has a default, so an unreviewed scenario still arrives with an empty
  // one. A review counts only once a decision was actually recorded.
  const reviewed = scenario.doctorReview?.decision ? scenario.doctorReview : undefined;

  return (
    <section
      className="mt-4 rounded-lg border p-5"
      style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
      aria-labelledby="decision-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="decision-heading" className="readout">
            {t("sr.heading")}
          </h3>
          <p className="mt-1.5 max-w-readable text-[13px] leading-relaxed text-ink-muted">
            {t("sr.intro")}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {humanizeEnum(scenario.status)}
        </span>
      </div>

      {scenario.recalculationRequired && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2.5">
          <p className="text-[13px] text-state-amber">
            <span aria-hidden>△ </span>
            {t("sr.outOfDate")}
          </p>
          <button
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
            className="rounded border border-state-amber/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-state-amber transition hover:bg-state-amber/10 disabled:opacity-60"
          >
            {recalculate.isPending ? t("sr.rerunning") : t("sr.rerun")}
          </button>
        </div>
      )}

      {reviewed ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded border bg-surface p-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                color: DECISIONS.find((d) => d.value === reviewed.decision)?.tone,
                borderColor: "var(--line-strong)",
              }}
            >
              {humanizeEnum(reviewed.decision)}
            </span>
            <span className="font-mono text-[11px] text-ink-faint">
              {formatDateTime(reviewed.reviewedAt)}
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ color: reviewed.visibleToPatient ? "var(--signal)" : "var(--ink-faint)" }}
            >
              {reviewed.visibleToPatient ? (summary?.approved ? t("sr.visible") : t("sr.waitingSummary")) : t("sr.notShared")}
            </span>
          </div>
          {reviewed.note && <p className="mt-2.5 text-[13px] leading-relaxed text-ink">{reviewed.note}</p>}
          <button
            onClick={() => {
              setDecision(reviewed.decision);
              setNote(reviewed.note ?? "");
              setVisibleToPatient(reviewed.visibleToPatient);
            }}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
          >
            {t("sr.revise")}
          </button>
        </motion.div>
      ) : null}

      {reviewed?.decision === "APPROVED" && reviewed.visibleToPatient && (
        <div className="mt-4 rounded border bg-surface p-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="readout">{t("sr.summaryHeading")}</span>
            <button
              type="button"
              onClick={() => generateSummary.mutate()}
              disabled={generateSummary.isPending}
              className="rounded border border-[color:var(--line-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
            >
              {generateSummary.isPending
                ? t("sr.summaryDrafting")
                : summary
                  ? t("sr.summaryRedraft")
                  : t("sr.summaryDraft")}
            </button>
          </div>
          <p className="mt-2 max-w-readable text-[12.5px] leading-relaxed text-ink-muted">{t("sr.summaryHint")}</p>
          {(
            <>
              <textarea
                value={summaryText}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                aria-label={t("sr.summaryHeading")}
                placeholder={t("sr.summaryPlaceholder")}
                className={`${inputClass} mt-3`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => approveSummary.mutate()}
                  disabled={approveSummary.isPending || summaryText.trim().length === 0}
                  className="rounded border border-[color:var(--line-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
                >
                  {t("sr.summaryApprove")}
                </button>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: summary?.approved && draft === null ? "var(--signal)" : "var(--ink-faint)" }}
                >
                  {summary?.approved && draft === null ? t("sr.summaryLive") : t("sr.summaryNotShared")}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {(!reviewed || decision) && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (decision) review.mutate();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <fieldset>
            <legend className="readout mb-2">{t("sr.decision")}</legend>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((option) => {
                const active = decision === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDecision(option.value)}
                    className="rounded border px-3.5 py-2 text-left text-[13px] transition"
                    style={{
                      borderColor: active ? option.tone : "var(--line)",
                      background: active ? "color-mix(in srgb, var(--surface) 92%, transparent)" : "var(--surface)",
                      color: active ? option.tone : "var(--ink)",
                      boxShadow: active ? `inset 0 0 0 1px ${option.tone}` : undefined,
                    }}
                  >
                    <span className="block font-medium">{t(option.label)}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{t(option.hint)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="readout">{t("sr.clinicalNote")}</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("sr.notePlaceholder")}
              className={`${inputClass} resize-y`}
            />
          </label>

          {decision === "APPROVED" && (
            <label className="flex items-start gap-2.5 rounded border border-[color:var(--line)] bg-surface px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-1"
                checked={visibleToPatient}
                onChange={(event) => setVisibleToPatient(event.target.checked)}
              />
              <span className="text-[13px] leading-relaxed text-ink">
                {t("sr.publish")}
                <span className="mt-0.5 block text-[12px] text-ink-faint">
                  {t("sr.publishHint")}
                </span>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!decision || review.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-50"
            >
              {review.isPending ? t("action.saving") : t("sr.recordDecision")}
            </button>
            {reviewed && (
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
