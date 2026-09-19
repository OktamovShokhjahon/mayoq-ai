"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DigitalTwinViewer } from "@/components/digital-twin/digital-twin-viewer";
import { api } from "@/lib/api-client";
import type { OrganSignal } from "@/components/digital-twin/types";
import { twinSex } from "@/components/digital-twin/anatomy";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

interface Scenario {
  _id: string;
  overallRisk: "green" | "yellow" | "red";
  signals: OrganSignal[];
  /** Organ states from the approved baseline snapshot, before the plan. */
  baselineSignals?: OrganSignal[];
  horizonDays: number;
  createdAt: string;
  modelId?: string;
  ruleSetVersion?: string;
  sourceRecordCount?: number;
  recalculationRequired?: boolean;
  /** Present only once a doctor has read and approved the wording. */
  patientSummary?: { text: string; modelId: string };
}

const HORIZONS = [7, 30, 90, 365];

export default function PatientDigitalTwinPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["approved-scenarios"],
    queryFn: () => api.get<Scenario[]>("/me/approved-scenarios"),
  });
  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<{ sex?: string }>("/me/profile"),
  });
  const [horizon, setHorizon] = useState(30);

  // Only horizons the doctor actually approved are offered.
  const available = useMemo(() => {
    const days = Array.from(new Set((data ?? []).map((item) => item.horizonDays)));
    return days.length > 0 ? days.sort((a, b) => a - b) : HORIZONS;
  }, [data]);

  const scenario =
    data?.find((item) => item.horizonDays === horizon) ?? data?.[0] ?? null;

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <div className="max-w-5xl">
        <span className="readout">{t("ptw.eyebrow")}</span>
        <h1 className="display mt-2 text-[30px] leading-tight text-ink">
          {t("ptw.title")}
        </h1>
        <p className="mt-3 max-w-readable text-[15px] leading-relaxed text-ink-muted">
          {t("ptw.description")}
        </p>

        <div className="rail my-8" />

        {isLoading && (
          <div className="h-[480px] animate-pulse rounded-lg bg-ink/[0.035]" role="status" aria-label={t("ptw.loading")} />
        )}

        {isError && (
          <div
            className="rounded-lg border p-6"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <h2 className="display text-[17px] text-ink">{t("ptw.errorTitle")}</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t("ptw.errorBody")}
            </p>
          </div>
        )}

        {!isLoading && !isError && scenario && (
          <div className="panel p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="readout">
                {t("ptw.approved", { date: formatDate(scenario.createdAt) })}
              </span>
              <RiskBadge color={scenario.overallRisk} />
            </div>

            {scenario.patientSummary && (
              <div className="mb-5 rounded border p-4" style={{ borderColor: "var(--line)", background: "var(--sunken)" }}>
                <span className="readout">{t("ptw.summary")}</span>
                <p className="mt-2 max-w-readable text-[14px] leading-relaxed text-ink">
                  {scenario.patientSummary.text}
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                  {scenario.patientSummary.modelId === "doctor-written"
                    ? t("ptw.summaryByDoctor")
                    : scenario.patientSummary.modelId.startsWith("demo-fallback")
                      ? t("ptw.summaryDemo")
                      : t("ptw.summaryProvenance", { model: scenario.patientSummary.modelId })}
                </p>
              </div>
            )}

            <DigitalTwinViewer
              beforeSignals={scenario.baselineSignals ?? []}
              afterSignals={scenario.signals}
              horizonDays={scenario.horizonDays}
              sex={twinSex(profile?.sex)}
              horizons={available}
              onHorizonChange={setHorizon}
              analysisMeta={{
                analyzedAt: scenario.createdAt,
                modelId: scenario.modelId,
                ruleSetVersion: scenario.ruleSetVersion,
                sourceRecordCount: scenario.sourceRecordCount,
                stale: scenario.recalculationRequired,
              }}
            />
          </div>
        )}

        {!isLoading && !isError && !scenario && (
          <div className="rounded-lg border p-8" style={{ borderColor: "var(--line)" }}>
            <h2 className="display text-[17px] text-ink">{t("ptw.noneTitle")}</h2>
            <p className="mt-2 max-w-readable text-sm leading-relaxed text-ink-muted">
              {t("ptw.noneBody")}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
