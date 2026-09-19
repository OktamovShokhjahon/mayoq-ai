"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel, Row, Skeleton } from "@/components/ui/console";
import { LabTrend, type LabRecord } from "@/components/charts/lab-trend";
import { PreventionPlanPanel } from "@/components/clinical/prevention-plan";
import { DeepAnalysis } from "@/components/clinical/deep-analysis";
import { twinSex } from "@/components/digital-twin/anatomy";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

interface Diagnosis {
  _id: string;
  label: string;
  status?: string;
}
interface Medication {
  _id: string;
  genericName: string;
  dosage: number;
  unit: string;
  frequency: string;
  purpose?: string;
}
interface Scenario {
  _id: string;
  overallRisk: RiskColor;
  horizonDays: number;
  createdAt: string;
}

export default function PatientDashboardPage() {
  const { t } = useI18n();
  const diagnoses = useQuery({
    queryKey: ["me-diagnoses"],
    queryFn: () => api.get<Diagnosis[]>("/me/diagnoses"),
  });
  const medications = useQuery({
    queryKey: ["me-medications"],
    queryFn: () => api.get<Medication[]>("/me/medications"),
  });
  const profile = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<{ profile?: { sex?: string } }>("/me/profile"),
  });
  const scenarios = useQuery({
    queryKey: ["approved-scenarios"],
    queryFn: () => api.get<Scenario[]>("/me/approved-scenarios"),
  });
  const history = useQuery({
    queryKey: ["me-history"],
    queryFn: () => api.get<LabRecord[]>("/me/medical-history"),
  });

  const latest = scenarios.data?.[0];

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow={t("pd.eyebrow")}
        title={t("pd.title")}
        description={t("pd.description")}
        meta={
          <>
            <MetaItem label={t("pd.metaDiagnoses")} value={String(diagnoses.data?.length ?? 0)} />
            <MetaItem label={t("pd.metaMedications")} value={String(medications.data?.length ?? 0)} />
            {latest && <MetaItem label={t("pd.metaLatestReview")} value={formatDate(latest.createdAt)} />}
          </>
        }
      />

      {/* The twin is the thing worth opening, so it leads. */}
      <section className="panel relative overflow-hidden p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="readout">{t("pd.twinEyebrow")}</span>
            <h2 className="display mt-2 text-[22px] leading-tight text-ink">
              {latest ? t("pd.twinReady") : t("pd.twinNone")}
            </h2>
            <p className="mt-2 max-w-readable text-[14px] leading-relaxed text-ink-muted">
              {latest ? t("pd.twinReadyBody") : t("pd.twinNoneBody")}
            </p>
          </div>
          {latest && <RiskBadge color={latest.overallRisk} />}
        </div>

        {latest && (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/patient/digital-twin"
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
            >
              {t("pd.openTwin")}
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {t("pd.horizonNote", { days: latest.horizonDays })}
            </span>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("pd.currentDiagnoses")}
          action={
            <Link
              href="/patient/diagnoses"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
            >
              {t("pd.all")}
            </Link>
          }
        >
          {diagnoses.isLoading ? (
            <Skeleton rows={3} />
          ) : diagnoses.data?.length ? (
            <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
              {diagnoses.data.map((item) => (
                <Row key={item._id} primary={item.label} secondary={item.status} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("pd.noDiagnoses")}
              body={t("pd.noDiagnosesBody")}
            />
          )}
        </Panel>

        <Panel
          title={t("pd.currentMedications")}
          action={
            <Link
              href="/patient/medications"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
            >
              {t("pd.all")}
            </Link>
          }
        >
          {medications.isLoading ? (
            <Skeleton rows={3} />
          ) : medications.data?.length ? (
            <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
              {medications.data.map((item) => (
                <Row
                  key={item._id}
                  primary={item.genericName}
                  secondary={`${item.dosage}${item.unit} · ${item.frequency}`}
                  trailing={
                    item.purpose ? (
                      <span className="shrink-0 text-[12px] text-ink-faint">{item.purpose}</span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("pd.noMedications")}
              body={t("pd.noMedicationsBody")}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title={t("pd.measurements")}>
          {history.isLoading ? <Skeleton rows={3} /> : <LabTrend records={history.data ?? []} />}
        </Panel>
      </div>

      <div className="mt-4">
        <DeepAnalysis endpoint="/me/deep-analysis" audience="patient" sex={twinSex(profile.data?.profile?.sex)} />
      </div>

      <PreventionPlanPanel endpoint="/me/prevention-plan" />

      <div className="mt-4">
        <Panel title={t("pd.questions")}>
          <p className="max-w-readable text-[14px] leading-relaxed text-ink-muted">
            {t("pd.questionsBody")}
          </p>
          <Link
            href="/patient/chat"
            className="mt-4 inline-block rounded border px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            {t("pd.askQuestion")}
          </Link>
        </Panel>
      </div>
    </AppShell>
  );
}
