"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel, Row, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, humanizeEnum } from "@/lib/format";

interface Scenario {
  _id: string;
  overallRisk: RiskColor;
  patientId: string;
  patientName?: string;
  patientCode?: string;
  createdAt: string;
  status: string;
}

export default function DoctorAlertsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["doctor-dashboard-analyses"],
    queryFn: () => api.get<{ recentAnalyses: Scenario[] }>("/doctor/dashboard"),
  });

  // Red before amber, then newest first within each band.
  const alerts = useMemo(() => {
    const rank: Record<RiskColor, number> = { red: 0, yellow: 1, green: 2 };
    return (data?.recentAnalyses ?? [])
      .filter((item) => item.overallRisk !== "green")
      .sort(
        (a, b) =>
          rank[a.overallRisk] - rank[b.overallRisk] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [data]);

  const high = alerts.filter((item) => item.overallRisk === "red").length;

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV}>
      <PageHeader
        eyebrow={t("da.eyebrow")}
        title={t("da.title")}
        description={t("da.description")}
        meta={
          data && (
            <>
              <MetaItem label={t("da.highPriority")} value={String(high)} />
              <MetaItem label={t("da.totalOpen")} value={String(alerts.length)} />
            </>
          )
        }
      />

      <Panel title={t("da.openAlerts")}>
        {isError ? (
          <EmptyState
            title={t("da.loadFailed")}
            body={t("da.loadFailedBody")}
          />
        ) : isLoading ? (
          <Skeleton rows={4} />
        ) : alerts.length === 0 ? (
          <EmptyState
            title={t("da.nothingOpen")}
            body={t("da.nothingOpenBody")}
          />
        ) : (
          <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {alerts.map((alert) => (
              <Row
                key={alert._id}
                href={`/doctor/patients/${alert.patientId}`}
                primary={alert.patientName ?? alert.patientCode ?? t("common.unnamedPatient")}
                secondary={`${formatDateTime(alert.createdAt)} · ${humanizeEnum(alert.status)}`}
                trailing={<RiskBadge color={alert.overallRisk} quiet />}
              />
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
