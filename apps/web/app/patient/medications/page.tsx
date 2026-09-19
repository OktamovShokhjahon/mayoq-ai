"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { formatDate, humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface Medication {
  _id: string;
  genericName: string;
  brandName?: string;
  dosage: number;
  unit: string;
  route: string;
  frequency: string;
  purpose?: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export default function PatientMedicationsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["me-medications"],
    queryFn: () => api.get<Medication[]>("/me/medications"),
  });

  const active = (data ?? []).filter((item) => item.status === "active");
  const stopped = (data ?? []).filter((item) => item.status !== "active");

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow={t("pr.eyebrow")}
        title={t("px.medTitle")}
        description={t("px.medDescription")}
        meta={
          data && (
            <>
              <MetaItem label={t("px.medCurrent")} value={String(active.length)} />
              <MetaItem label={t("px.medStopped")} value={String(stopped.length)} />
            </>
          )
        }
      />

      {isLoading ? (
        <Panel title={t("px.medTitle")}>
          <Skeleton rows={3} />
        </Panel>
      ) : (data?.length ?? 0) === 0 ? (
        <Panel title={t("px.medTitle")}>
          <EmptyState
            title={t("px.medNone")}
            body={t("px.medNoneBody")}
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {[
            { key: "active", title: t("px.medTakingNow"), rows: active },
            { key: "stopped", title: t("px.medNoLonger"), rows: stopped },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.key}>
                <h2 className="readout mb-2">{group.title}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.rows.map((medication) => (
                    <article
                      key={medication._id}
                      className="panel p-5"
                      style={{ opacity: medication.status === "active" ? 1 : 0.7 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-medium text-ink">{medication.genericName}</h3>
                          {medication.brandName && (
                            <p className="text-[12px] text-ink-faint">{medication.brandName}</p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                          {humanizeEnum(medication.status)}
                        </span>
                      </div>

                      <p className="mt-3 font-mono text-[14px] tabular-nums text-ink">
                        {medication.dosage}
                        {medication.unit}
                        <span className="text-ink-muted"> · {medication.frequency}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                        {humanizeEnum(medication.route)}
                        {medication.startDate ? t("px.medSince", { date: formatDate(medication.startDate) }) : ""}
                      </p>

                      {medication.purpose && (
                        <p className="mt-3 border-t border-[color:var(--line)] pt-3 text-[13px] leading-relaxed text-ink-muted">
                          {t("px.medPurpose", { purpose: medication.purpose })}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </AppShell>
  );
}
