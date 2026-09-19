"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Mark } from "@/components/ui/app-shell";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: "ADMIN" | "DOCTOR" | "PATIENT"; fullName: string; email: string; tenantId: string };
}

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  DOCTOR: "/doctor/dashboard",
  PATIENT: "/patient/dashboard",
};

/**
 * The seeded demo clinic. Shown only when the app is pointed at a local API —
 * these credentials belong to synthetic patients created by `npm run seed`, and
 * a deployed instance must never offer to fill anything in.
 */
const DEMO_ACCOUNTS: Array<{ role: MessageKey; email: string; password: string }> = [
  { role: "role.admin", email: "admin@twinrx.example", password: "DemoAdminPass123!" },
  { role: "role.doctor", email: "doctor@twinrx.example", password: "DemoDoctorPass123!" },
  // Patient Beta is the seeded account with a published scenario, so the
  // patient-facing twin has something to show straight away.
  { role: "role.patient", email: "patient2@twinrx.example", password: "DemoPatientPass123!" },
];

function isLocalApi(): boolean {
  const url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

const fieldClass =
  "w-full rounded-md border bg-ink/[0.035] px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-signal";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(withEmail: string, withPassword: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<LoginResponse>("/auth/login", {
        email: withEmail,
        password: withPassword,
      });
      setSession(result);
      router.push(ROLE_HOME[result.user.role] ?? "/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? t("login.badCredentials")
            : err.message
          : t("login.noServer"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[color:var(--electric)]/10 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-[color:var(--signal)]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <form onSubmit={(event) => { event.preventDefault(); signIn(email, password); }} className="panel flex flex-col gap-5 p-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2">
                <Mark className="h-4 w-4" />
                <span className="readout">MAYOQ AI</span>
              </Link>
              <LanguageSwitcher />
            </div>
            <h1 className="display mt-3 text-[26px] leading-tight text-ink">{t("login.title")}</h1>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              {t("login.subtitle")}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="readout">{t("login.email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "var(--line)" }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="readout">{t("login.password")}</span>
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink"
              >
                {showPassword ? t("login.hide") : t("login.show")}
              </button>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "var(--line)" }}
            />
          </label>

          {error && (
            <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-md bg-electric px-4 py-2.5 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
          >
            {loading ? t("login.signingIn") : t("action.signIn")}
          </button>

          <p className="text-center text-[13px] text-ink-muted">
            {t("login.registerPrompt")}{" "}
            <Link href="/register" className="text-signal hover:underline">
              {t("login.registerLink")}
            </Link>
          </p>
        </form>

        {isLocalApi() && (
          <div className="panel-sunken mt-4 p-4">
            <p className="readout">{t("login.demoClinic")}</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      signIn(account.email, account.password);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left transition hover:bg-ink/[0.04] disabled:opacity-60"
                  >
                    <span className="text-[13px] text-ink">{t(account.role)}</span>
                    <span className="font-mono text-[11px] text-ink-faint">{account.email}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              {t("login.demoNote")}
            </p>
          </div>
        )}
      </motion.div>
    </main>
  );
}
