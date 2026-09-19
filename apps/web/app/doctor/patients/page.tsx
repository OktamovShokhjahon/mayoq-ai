"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api-client";
import { humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface PatientRow {
  _id: string;
  patientCode: string;
  status: string;
  user?: { fullName: string; email: string; phone?: string };
}

const EMPTY = { fullName: "", email: "", phone: "", password: "" };

const STATUSES = ["ALL", "ACTIVE", "INCOMPLETE", "NEEDS_REVIEW", "FOLLOW_UP", "ARCHIVED"] as const;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--state-green)",
  NEEDS_REVIEW: "var(--state-amber)",
  INCOMPLETE: "var(--state-amber)",
  FOLLOW_UP: "var(--signal)",
  ARCHIVED: "var(--ink-faint)",
};

export default function DoctorPatientsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-patients", search, status],
    queryFn: () => {
      // Both filters are applied server-side so the panel count matches what a
      // search would return on a clinic with more patients than one page.
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "ALL") params.set("status", status);
      const query = params.toString();
      return api.get<PatientRow[]>(`/patients${query ? `?${query}` : ""}`);
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const createPatient = useMutation({
    mutationFn: () => api.post<{ patient: { id: string } }>("/patients", form),
    onSuccess: (res) => {
      setForm(EMPTY);
      setError(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
      // Straight into the chart: creating a patient is always the first step
      // of recording something about them.
      router.push(`/doctor/patients/${res.patient.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : t("dp.createFailed")),
  });

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV}>
      <PageHeader
        eyebrow={t("dd.eyebrow")}
        title={t("dp.title")}
        description={t("dp.description")}
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {t("dd.newPatient")}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          placeholder={t("dp.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("dp.searchLabel")}
          className={`${inputClass} max-w-sm`}
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("filter.byStatus")}>
          {STATUSES.map((option) => (
            <button
              key={option}
              onClick={() => setStatus(option)}
              aria-pressed={status === option}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                status === option
                  ? "border-[color:var(--signal)] text-signal"
                  : "border-[color:var(--line)] text-ink-faint hover:text-ink"
              }`}
            >
              {option === "ALL" ? t("filter.all") : humanizeEnum(option)}
            </button>
          ))}
        </div>
      </div>

      <Panel title={`${t("dp.panel")}${data ? ` · ${data.length}` : ""}`}>
        {isLoading ? (
          <Skeleton rows={5} />
        ) : data && data.length > 0 ? (
          <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {data.map((patient) => (
              <li key={patient._id}>
                <Link
                  href={`/doctor/patients/${patient._id}`}
                  className="flex items-center justify-between gap-4 rounded px-3 py-3 transition hover:bg-ink/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {patient.user?.fullName ?? t("common.unnamedPatient")}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {patient.patientCode}
                      {patient.user?.phone ? ` · ${patient.user.phone}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: STATUS_COLOR[patient.status] ?? "var(--ink-faint)" }}
                  >
                    {humanizeEnum(patient.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={
              search || status !== "ALL" ? t("dp.noMatch") : t("dp.none")
            }
            body={
              search || status !== "ALL"
                ? t("dp.noMatchBody")
                : t("dp.noneBody")
            }
            action={
              search || status !== "ALL" ? (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatus("ALL");
                  }}
                  className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
                >
                  {t("dp.clearFilters")}
                </button>
              ) : undefined
            }
          />
        )}
      </Panel>

      <Modal
        open={open}
        onClose={close}
        title={t("dp.newPatientTitle")}
        description={t("dp.newPatientDescription")}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="create-patient"
              disabled={createPatient.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {createPatient.isPending ? t("common.creating") : t("dp.create")}
            </button>
          </>
        }
      >
        <form
          id="create-patient"
          onSubmit={(event) => {
            event.preventDefault();
            createPatient.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t("common.fullName")}>
            <input
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label={t("common.phone")}>
            <input
              type="tel"
              required
              minLength={5}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label={t("common.email")}>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field
            label={t("common.password")}
            hint={t("dp.passwordHint")}
          >
            <input
              type="text"
              required
              minLength={10}
              autoComplete="off"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={inputClass}
            />
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red"
            >
              {error}
            </p>
          )}
        </form>
      </Modal>
    </AppShell>
  );
}
