"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  DistributionBars,
  EmptyState,
  MetaItem,
  PageHeader,
  Panel,
  QueueCard,
  RiskRibbon,
  Row,
} from "@/components/ui/console";
import { AnalysisTrend, type TrendPoint } from "@/components/charts/analysis-trend";
import { api } from "@/lib/api-client";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import type { RiskColor } from "@/components/digital-twin/types";
import { useI18n } from "@/lib/i18n";

interface DashboardData {
  activeDoctors: number;
  activePatients: number;
  patientsByStatus: Array<{ _id: string; count: number }>;
  recentAnalyses: Array<{
    _id: string;
    overallRisk: RiskColor;
    createdAt: string;
    patientId: string;
    patientName?: string;
    patientCode?: string;
  }>;
  highRiskAlerts: number;
}

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard"),
  });

  const { data: trends } = useQuery({
    queryKey: ["analytics-trends"],
    queryFn: () => api.get<TrendPoint[]>("/analytics/trends"),
  });

  const counts = useMemo(() => {
    const tally: Record<RiskColor, number> = { green: 0, yellow: 0, red: 0 };
    for (const analysis of data?.recentAnalyses ?? []) tally[analysis.overallRisk] += 1;
    return tally;
  }, [data]);

  const statuses = useMemo(
    () =>
      [...(data?.patientsByStatus ?? [])]
        .sort((a, b) => b.count - a.count)
        .map((item) => ({ label: humanizeEnum(item._id), count: item.count })),
    [data],
  );

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow={t("ad.eyebrow")}
        title={t("ad.title")}
        description={t("ad.description")}
        action={
          <Link
            href="/admin/doctors"
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {t("ad.manageDoctors")}
          </Link>
        }
        meta={
          data && (
            <>
              <MetaItem label={t("ad.activeDoctors")} value={String(data.activeDoctors)} />
              <MetaItem label={t("ad.activePatients")} value={String(data.activePatients)} />
              <MetaItem label={t("ad.updated")} value={new Date().toLocaleTimeString()} />
            </>
          )
        }
      />

      {isError && (
        <div className="panel p-6">
          <EmptyState
            title={t("ad.loadFailed")}
            body={t("ad.loadFailedBody")}
          />
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="panel h-[136px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <QueueCard
              label={t("ad.highPriorityAlerts")}
              count={data.highRiskAlerts}
              hint={t("ad.highPriorityHint")}
              href="/admin/patients"
              tone="red"
              index={0}
            />
            <QueueCard
              label={t("ad.activeDoctors")}
              count={data.activeDoctors}
              hint={t("ad.activeDoctorsHint")}
              href="/admin/doctors"
              kind="stat"
              index={1}
            />
            <QueueCard
              label={t("ad.activePatients")}
              count={data.activePatients}
              hint={t("ad.activePatientsHint")}
              href="/admin/patients"
              kind="stat"
              index={2}
            />
          </div>

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title={t("ad.patientsByStatus")}>
              <DistributionBars items={statuses} />
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                {t("ad.patientsByStatusNote")}
              </p>
            </Panel>

            <Panel title={t("ad.riskAcross")}>
              <RiskRibbon counts={counts} />
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                {t("ad.riskAcrossNote")}
              </p>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title={t("ad.analysisVolume")}>
              <AnalysisTrend data={trends ?? []} />
              <p className="mt-4 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                {t("ad.analysisVolumeNote")}
              </p>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel
              title={t("ad.recentAnalyses")}
              action={
                <Link
                  href="/admin/audit"
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
                >
                  {t("ad.auditLog")}
                </Link>
              }
            >
              {data.recentAnalyses.length === 0 ? (
                <EmptyState
                  title={t("ad.noAnalyses")}
                  body={t("ad.noAnalysesBody")}
                />
              ) : (
                <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {data.recentAnalyses.map((analysis) => (
                    <Row
                      key={analysis._id}
                      primary={analysis.patientName ?? analysis.patientCode ?? t("common.unnamedPatient")}
                      secondary={formatDateTime(analysis.createdAt)}
                      trailing={<RiskBadge color={analysis.overallRisk} quiet />}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
