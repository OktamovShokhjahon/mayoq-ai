"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

const RECORD_TYPES = [
  { value: "symptom", label: "hm.type.symptom" },
  { value: "lab_result", label: "hm.type.lab_result" },
  { value: "vital_sign", label: "hm.type.vital_sign" },
  { value: "procedure", label: "hm.type.procedure" },
  { value: "allergy", label: "hm.type.allergy" },
  { value: "lifestyle_observation", label: "hm.type.lifestyle_observation" },
  { value: "diagnosis", label: "hm.type.diagnosis" },
  { value: "medication", label: "hm.type.medication" },
] as const satisfies ReadonlyArray<{ value: string; label: MessageKey }>;

const SOURCES = [
  { value: "doctor_entry", label: "hm.src.doctor_entry" },
  { value: "patient_report", label: "hm.src.patient_report" },
  { value: "laboratory", label: "hm.src.laboratory" },
  { value: "external_document", label: "hm.src.external_document" },
  { value: "other", label: "hm.src.other" },
] as const satisfies ReadonlyArray<{ value: string; label: MessageKey }>;

const EMPTY = {
  type: "symptom" as (typeof RECORD_TYPES)[number]["value"],
  eventDate: new Date().toISOString().slice(0, 10),
  description: "",
  field: "",
  value: "",
  unit: "",
  sourceType: "doctor_entry" as (typeof SOURCES)[number]["value"],
  note: "",
};

/**
 * Past history entry. Everything here is optional — a chart is useful without
 * it, and a doctor should be able to add one record now and the rest later
 * rather than face a form that demands a complete history up front.
 *
 * A measured value is captured as a named field so the rule engine can read it;
 * free text alone cannot drive a deterministic check.
 */
export function HistoryModal({
  patientId,
  open,
  onClose,
}: {
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const measurable = form.type === "lab_result" || form.type === "vital_sign";

  const addRecord = useMutation({
    mutationFn: () =>
      api.post(`/patients/${patientId}/records`, {
        type: form.type,
        eventDate: new Date(form.eventDate).toISOString(),
        sourceType: form.sourceType,
        status: "verified",
        note: form.note || undefined,
        data: {
          description: form.description || undefined,
          ...(measurable && form.field
            ? { field: form.field, value: Number(form.value), unit: form.unit || undefined }
            : {}),
        },
      }),
    onSuccess: () => {
      setSavedCount((count) => count + 1);
      setError(null);
      // Keep the type and date: history is usually entered in runs.
      setForm((f) => ({ ...f, description: "", field: "", value: "", unit: "", note: "" }));
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : t("hm.saveFailed")),
  });

  function close() {
    setError(null);
    setSavedCount(0);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t("hm.title")}
      description={t("hm.description")}
      footer={
        <>
          {savedCount > 0 && (
            <span className="mr-auto font-mono text-[11px] uppercase tracking-[0.1em] text-state-green">
              {t("hm.saved", { count: savedCount })}
            </span>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
          >
            {t("action.done")}
          </button>
          <button
            type="submit"
            form="add-history"
            disabled={addRecord.isPending}
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
          >
            {addRecord.isPending ? t("action.saving") : t("hm.saveAndAdd")}
          </button>
        </>
      }
    >
      <form
        id="add-history"
        onSubmit={(event) => {
          event.preventDefault();
          addRecord.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("hm.recordType")}>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))
              }
              className={inputClass}
            >
              {RECORD_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("hm.when")}>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.eventDate}
              onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("hm.description2")}>
          <input
            required
            placeholder={t("hm.descriptionPlaceholder")}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClass}
          />
        </Field>

        {measurable && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("hm.measurement")} hint={t("hm.measurementHint")}>
              <input
                placeholder={t("hm.measurementPlaceholder")}
                value={form.field}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("hm.value")}>
              <input
                type="number"
                step="any"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("hm.unit")}>
              <input
                placeholder={t("hm.unitPlaceholder")}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <Field label={t("hm.whereFrom")}>
          <select
            value={form.sourceType}
            onChange={(e) =>
              setForm((f) => ({ ...f, sourceType: e.target.value as typeof f.sourceType }))
            }
            className={inputClass}
          >
            {SOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("hm.note")} hint={t("hm.noteHint")}>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={`${inputClass} resize-y`}
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
  );
}
