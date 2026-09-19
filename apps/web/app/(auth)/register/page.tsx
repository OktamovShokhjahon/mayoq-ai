"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

type FieldKey = "clinicName" | "adminFullName" | "adminEmail" | "password";

/** Field order is fixed; the label is a key so the form speaks the console's language. */
const FIELDS: Array<{ key: FieldKey; label: MessageKey; type?: string }> = [
  { key: "clinicName", label: "register.clinicName" },
  { key: "adminFullName", label: "register.fullName" },
  { key: "adminEmail", label: "register.email", type: "email" },
  { key: "password", label: "register.password", type: "password" },
];

export default function RegisterClinicPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    clinicName: "",
    adminFullName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(key: FieldKey, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/register-clinic", form);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("register.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="panel flex flex-col gap-4 p-8"
      >
        <h1 className="display text-[26px] leading-tight text-ink">{t("register.title")}</h1>
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="readout">{t(field.label)}</span>
            <input
              type={field.type ?? "text"}
              required
              minLength={field.key === "password" ? 10 : undefined}
              value={form[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              className="w-full rounded border bg-ink/[0.035] px-3 py-2 text-[15px] text-ink outline-none transition focus:border-signal" style={{ borderColor: "var(--line)" }}
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded border border-state-green/40 bg-state-green/10 px-3 py-2 text-sm text-state-green">
            {t("register.done")}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded bg-electric px-4 py-2.5 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
        >
          {loading ? t("register.creating") : t("register.submit")}
        </button>
      </motion.form>
    </main>
  );
}
