"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { formatDate, humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface Diagnosis {
  _id: string;
  label: string;
  diagnosedAt: string;
  state: string;
  code?: string;
}

export default function PatientDiagnosesPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["me-diagnoses"],
    queryFn: () => api.get<Diagnosis[]>("/me/diagnoses"),
  });

  const active = (data ?? []).filter((item) => item.state === "active");
  const past = (data ?? []).filter((item) => item.state !== "active");

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow={t("pr.eyebrow")}
        title={t("px.dxTitle")}
        description={t("px.dxDescription")}
        meta={
          data && (
            <>
              <MetaItem label={t("px.dxActive")} value={String(active.length)} />
              <MetaItem label={t("px.dxPast")} value={String(past.length)} />
            </>
          )
        }
      />

      {isLoading ? (
        <Panel title={t("px.dxTitle")}>
          <Skeleton rows={3} />
        </Panel>
      ) : (data?.length ?? 0) === 0 ? (
        <Panel title={t("px.dxTitle")}>
          <EmptyState
            title={t("px.dxNone")}
            body={t("px.dxNoneBody")}
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {[
            { key: "active", title: t("px.dxGroupActive"), rows: active },
            { key: "past", title: t("px.dxGroupPast"), rows: past },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <Panel key={group.key} title={group.title}>
                <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {group.rows.map((diagnosis) => (
                    <li key={diagnosis._id} className="flex flex-wrap items-baseline justify-between gap-3 px-2 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] text-ink">{diagnosis.label}</p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                          {humanizeEnum(diagnosis.state)}
                          {diagnosis.code ? ` · ${diagnosis.code}` : ""}
                        </p>
                      </div>
                      <span className="font-mono text-[12px] tabular-nums text-ink-muted">
                        {t("px.dxRecorded", { date: formatDate(diagnosis.diagnosedAt) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </AppShell>
  );
}
