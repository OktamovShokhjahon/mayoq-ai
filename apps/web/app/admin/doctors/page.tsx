"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { humanizeEnum } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface Doctor {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: string;
}

const EMPTY = { fullName: "", email: "", phone: "", password: "" };

export default function AdminDoctorsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [tempPasswordFor, setTempPasswordFor] = useState<{ name: string; password: string } | null>(null);
  const { data: doctors, isLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<Doctor[]>("/admin/doctors"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const createDoctor = useMutation({
    mutationFn: () => api.post<{ doctor: Doctor }>("/admin/doctors", form),
    onSuccess: (res) => {
      setCreated(res.doctor.fullName);
      setForm(EMPTY);
      setError(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : t("adr.createFailed")),
  });

  const resetPassword = useMutation({
    mutationFn: (doctor: Doctor) =>
      api
        .post<{ tempPassword: string }>(`/admin/doctors/${doctor._id}/reset-password`)
        .then((result) => ({ ...result, name: doctor.fullName })),
    onSuccess: (result) => {
      // Shown once, here, and never stored in the clinic record: the admin has
      // to hand it over before leaving this screen.
      setTempPasswordFor({ name: result.name, password: result.tempPassword });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : t("adr.resetFailed")),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      api.patch(`/admin/doctors/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctors"] }),
  });

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow={t("ad.eyebrow")}
        title={t("adr.title")}
        description={t("adr.description")}
        action={
          <button
            onClick={() => {
              setCreated(null);
              setOpen(true);
            }}
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {t("adr.addDoctor")}
          </button>
        }
      />

      {tempPasswordFor && (
        <div
          role="status"
          className="mb-4 rounded border border-state-amber/40 bg-state-amber/10 px-4 py-3"
        >
          <p className="text-sm text-state-amber">
            {t("adr.tempPasswordFor", { name: tempPasswordFor.name })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded bg-surface px-2.5 py-1 font-mono text-[13px] text-ink">
              {tempPasswordFor.password}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(tempPasswordFor.password);
                toast(t("adr.copied"));
              }}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-signal hover:underline"
            >
              {t("adr.copy")}
            </button>
            <button
              onClick={() => setTempPasswordFor(null)}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              {t("adr.dismiss")}
            </button>
          </div>
        </div>
      )}

      {created && (
        <p
          role="status"
          className="mb-4 rounded border border-state-green/40 bg-state-green/10 px-4 py-2.5 text-sm text-state-green"
        >
          {t("adr.created", { name: created })}
        </p>
      )}

      <Panel title={`${t("adr.doctors")}${doctors ? ` · ${doctors.length}` : ""}`}>
        {isLoading ? (
          <Skeleton rows={4} />
        ) : doctors && doctors.length > 0 ? (
          <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {doctors.map((doctor) => (
              <li
                key={doctor._id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] text-ink">{doctor.fullName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {doctor.email}
                    {doctor.phone ? ` · ${doctor.phone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{
                      color:
                        doctor.status === "active"
                          ? "var(--state-green)"
                          : doctor.status === "inactive"
                            ? "var(--ink-faint)"
                            : "var(--state-amber)",
                    }}
                  >
                    {humanizeEnum(doctor.status)}
                  </span>
                  <button
                    onClick={() => resetPassword.mutate(doctor)}
                    disabled={resetPassword.isPending}
                    className="rounded border border-[color:var(--line)] px-3 py-1.5 text-sm text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
                  >
                    {t("adr.resetPassword")}
                  </button>
                  <button
                    onClick={() =>
                      toggleStatus.mutate({
                        id: doctor._id,
                        status: doctor.status === "active" ? "inactive" : "active",
                      })
                    }
                    className="rounded border border-[color:var(--line)] px-3 py-1.5 text-sm text-ink transition hover:bg-ink/[0.04]"
                  >
                    {doctor.status === "active" ? t("adr.deactivate") : t("adr.activate")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={t("adr.none")}
            body={t("adr.noneBody")}
          />
        )}
      </Panel>

      <Modal
        open={open}
        onClose={close}
        title={t("adr.modalTitle")}
        description={t("adr.modalDescription")}
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
              form="create-doctor"
              disabled={createDoctor.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {createDoctor.isPending ? t("common.creating") : t("adr.create")}
            </button>
          </>
        }
      >
        <form
          id="create-doctor"
          onSubmit={(event) => {
            event.preventDefault();
            createDoctor.mutate();
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

          <Field label={t("common.email")}>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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

          <Field label={t("common.password")} hint={t("adr.passwordHint")}>
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
