"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskMarker } from "@/components/ui/risk-badge";
import {
  EmptyState,
  MetaItem,
  PageHeader,
  Panel,
  RiskRibbon,
  Row,
  Skeleton,
  TriageBand,
} from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";
import { formatListDate } from "@/lib/format";

interface DoctorDashboard {
  assignedPatients: number;
  needsReview: number;
  newAlerts: number;
  missingDataTasks: number;
  recentAnalyses: Array<{
    _id: string;
    overallRisk: RiskColor;
    createdAt: string;
    patientId?: string;
    patientName?: string;
    patientCode?: string;
    status?: string;
  }>;
}

export default function DoctorDashboardPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["doctor-dashboard"],
    queryFn: () => api.get<DoctorDashboard>("/doctor/dashboard"),
  });

  const counts = useMemo(() => {
    const tally: Record<RiskColor, number> = { green: 0, yellow: 0, red: 0 };
    for (const analysis of data?.recentAnalyses ?? []) tally[analysis.overallRisk] += 1;
    return tally;
  }, [data]);

  // Worst first: a dashboard that lists newest-first buries the red result.
  const ranked = useMemo(() => {
    const rank: Record<RiskColor, number> = { red: 0, yellow: 1, green: 2 };
    return [...(data?.recentAnalyses ?? [])].sort(
      (a, b) =>
        rank[a.overallRisk] - rank[b.overallRisk] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data]);

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV}>
      <PageHeader
        title={t("dd.title")}
        description={t("dd.description")}
        action={
          <Link
            href="/doctor/patients"
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {t("dd.newPatient")}
          </Link>
        }
        meta={
          data && (
            <>
              <MetaItem label={t("dd.assignedPatients")} value={String(data.assignedPatients)} />
              <MetaItem
                label={t("dd.analysesShown")}
                value={String(data.recentAnalyses.length)}
              />
              <MetaItem label={t("dd.updated")} value={new Date().toLocaleTimeString()} />
            </>
          )
        }
      />

      {isError && (
        <div className="panel p-6">
          <EmptyState
            title={t("dd.loadFailed")}
            body={t("dd.loadFailedBody")}
          />
        </div>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="panel h-[104px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Triage band: only the queues with work in them are lit. */}
          <TriageBand
            queues={[
              {
                label: t("dd.newAlerts"),
                count: data.newAlerts,
                hint: t("dd.newAlertsHint"),
                href: "/doctor/alerts",
                tone: "red",
              },
              {
                label: t("dd.needsReview"),
                count: data.needsReview,
                hint: t("dd.needsReviewHint"),
                href: "/doctor/patients",
                tone: "amber",
              },
              {
                label: t("dd.missingData"),
                count: data.missingDataTasks,
                hint: t("dd.missingDataHint"),
                href: "/doctor/patients",
                tone: "amber",
              },
            ]}
          />

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Panel
              title={t("dd.recentAnalyses")}
              action={
                <Link
                  href="/doctor/alerts"
                  className="text-[13px] font-medium text-signal hover:underline"
                >
                  {t("dd.allAlerts")}
                </Link>
              }
            >
              {ranked.length === 0 ? (
                <EmptyState
                  title={t("dd.noAnalyses")}
                  body={t("dd.noAnalysesBody")}
                  action={
                    <Link
                      href="/doctor/patients"
                      className="mt-1 text-[13px] font-medium text-signal hover:underline"
                    >
                      {t("dd.goToPatients")}
                    </Link>
                  }
                />
              ) : (
                <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {ranked.map((analysis) => (
                    <Row
                      key={analysis._id}
                      href={analysis.patientId ? `/doctor/patients/${analysis.patientId}` : undefined}
                      primary={
                        analysis.patientName ??
                        analysis.patientCode ??
                        t("common.unnamedPatient")
                      }
                      marker={<RiskMarker color={analysis.overallRisk} />}
                      secondary={`${formatListDate(analysis.createdAt)}${analysis.status ? ` · ${t(`scenarioStatus.${analysis.status}` as MessageKey)}` : ""}`}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title={t("dd.riskAcross")}>
                <RiskRibbon counts={counts} />
              </Panel>

              <Panel title={t("dd.beforeYouDecide")} tier="quiet">
                <ul className="flex flex-col gap-3">
                  {(["dd.note1", "dd.note2", "dd.note3"] as const).map((line) => (
                    <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal"
                      />
                      {t(line)}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
