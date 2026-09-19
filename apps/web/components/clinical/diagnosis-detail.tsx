"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

export interface DiagnosisAiDetail {
  summary: string;
  monitoring: string[];
  verifyBeforeTreating: string[];
  redFlags: string[];
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  verificationStatus: "ai_unverified" | "verified" | "rejected";
}

/**
 * The model's expansion of a diagnosis the doctor typed.
 *
 * It is shown as an interpretation awaiting review, never as part of the
 * record — until a doctor approves it, it carries the unverified grade and
 * cannot be mistaken for a confirmed clinical fact (technical mission §5).
 */
export function DiagnosisDetail({
  patientId,
  diagnosisId,
  detail,
  pending,
  onGenerate,
}: {
  patientId: string;
  diagnosisId: string;
  detail?: DiagnosisAiDetail;
  pending: boolean;
  onGenerate: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const review = useMutation({
    mutationFn: (approve: boolean) =>
      api.post(`/patients/${patientId}/diagnoses/${diagnosisId}/detail/review`, { approve }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diagnoses", patientId] }),
  });

  if (pending) {
    return (
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint" role="status">
        {t("dx.writing")}
      </p>
    );
  }

  if (!detail) {
    return (
      <button
        type="button"
        onClick={onGenerate}
        className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
      >
        {t("dx.add")}
      </button>
    );
  }

  if (detail.verificationStatus === "rejected") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
          {t("dx.rejected")}
        </span>
        <button
          type="button"
          onClick={onGenerate}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
        >
          {t("dx.rewrite")}
        </button>
      </div>
    );
  }

  const lists: Array<{ heading: MessageKey; items: string[]; tone?: string }> = [
    { heading: "dx.monitored", items: detail.monitoring },
    { heading: "dx.confirmBefore", items: detail.verifyBeforeTreating },
    { heading: "dx.redFlags", items: detail.redFlags, tone: "var(--state-red)" },
  ];

  return (
    <div
      className="mt-3 rounded-lg border p-3"
      style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ProvenanceChip
          grade={detail.verificationStatus === "verified" ? "verified" : "ai_unverified"}
        />
        <span className="readout">{detail.modelId}</span>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-muted">{detail.summary}</p>

      {lists.map(
        (list) =>
          list.items.length > 0 && (
            <div key={list.heading} className="mt-3">
              <h4 className="readout" style={list.tone ? { color: list.tone } : undefined}>
                {t(list.heading)}
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1">
                {list.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
                    <span
                      aria-hidden
                      className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                      style={{ background: list.tone ?? "var(--signal)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}

      {detail.verificationStatus === "ai_unverified" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-3">
          <span className="text-[12px] text-ink-faint">{t("dx.matches")}</span>
          <button
            type="button"
            onClick={() => review.mutate(true)}
            disabled={review.isPending}
            className="rounded border border-state-green/40 bg-state-green/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-state-green transition hover:bg-state-green/20 disabled:opacity-60"
          >
            {t("action.approve")}
          </button>
          <button
            type="button"
            onClick={() => review.mutate(false)}
            disabled={review.isPending}
            className="rounded border border-[color:var(--line-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted transition hover:bg-ink/[0.04] disabled:opacity-60"
          >
            {t("action.reject")}
          </button>
        </div>
      )}
    </div>
  );
}
