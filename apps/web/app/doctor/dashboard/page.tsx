"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  EmptyState,
  MetaItem,
  PageHeader,
  Panel,
  QueueCard,
  RiskRibbon,
  Row,
  Skeleton,
} from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, humanizeEnum } from "@/lib/format";

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
        eyebrow={t("dd.eyebrow")}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="panel h-[136px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Triage strip: the reason to open this page at all. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueueCard
              label={t("dd.needsReview")}
              count={data.needsReview}
              hint={t("dd.needsReviewHint")}
              href="/doctor/patients"
              tone="amber"
              index={0}
            />
            <QueueCard
              label={t("dd.newAlerts")}
              count={data.newAlerts}
              hint={t("dd.newAlertsHint")}
              href="/doctor/alerts"
              tone="red"
              index={1}
            />
            <QueueCard
              label={t("dd.missingData")}
              count={data.missingDataTasks}
              hint={t("dd.missingDataHint")}
              href="/doctor/patients"
              tone="amber"
              index={2}
            />
            <QueueCard
              label={t("dd.assignedPatients")}
              count={data.assignedPatients}
              hint={t("dd.onYourPanel")}
              href="/doctor/patients"
              kind="stat"
              index={3}
            />
          </div>

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Panel
              title={t("dd.recentAnalyses")}
              action={
                <Link
                  href="/doctor/alerts"
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
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
                      className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
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
                      secondary={`${formatDateTime(analysis.createdAt)}${
                        analysis.status ? ` · ${humanizeEnum(analysis.status)}` : ""
                      }`}
                      trailing={<RiskBadge color={analysis.overallRisk} quiet />}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title={t("dd.riskAcross")}>
                <RiskRibbon counts={counts} />
              </Panel>

              <Panel title={t("dd.beforeYouDecide")}>
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
