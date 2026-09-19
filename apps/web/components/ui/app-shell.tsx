"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthHydrated, useAuthStore, type Role } from "@/lib/auth-store";
import { initials } from "@/lib/format";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

export interface NavItem {
  href: string;
  /** Translated at render. Nav labels are chrome, and chrome is translated. */
  key: MessageKey;
}

/**
 * The navigation each role sees. Defined once here rather than restated in
 * every page: fifteen copies of the same array is fifteen places a new section
 * has to be remembered, and fifteen places a translation can drift.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", key: "nav.dashboard" },
  { href: "/admin/doctors", key: "nav.doctors" },
  { href: "/admin/patients", key: "nav.patients" },
  { href: "/admin/audit", key: "nav.audit" },
  { href: "/admin/subscription", key: "nav.subscription" },
];

export const DOCTOR_NAV: NavItem[] = [
  { href: "/doctor/dashboard", key: "nav.dashboard" },
  { href: "/doctor/patients", key: "nav.patients" },
  { href: "/doctor/alerts", key: "nav.alerts" },
];

export const PATIENT_NAV: NavItem[] = [
  { href: "/patient/dashboard", key: "nav.dashboard" },
  { href: "/patient/history", key: "nav.history" },
  { href: "/patient/diagnoses", key: "nav.diagnoses" },
  { href: "/patient/medications", key: "nav.medications" },
  { href: "/patient/digital-twin", key: "nav.digitalTwin" },
  { href: "/patient/chat", key: "nav.chat" },
];

const ROLE_KEY: Record<Role, MessageKey> = {
  ADMIN: "role.admin",
  DOCTOR: "role.doctor",
  PATIENT: "role.patient",
};

export function AppShell({
  children,
  role,
  navItems,
  /**
   * Replaces the last breadcrumb. Route segments are object ids on detail
   * pages, and `6AAD93E1…` tells the person reading it nothing.
   */
  crumbOverride,
}: {
  children: React.ReactNode;
  role: Role;
  navItems: NavItem[];
  crumbOverride?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const hydrated = useAuthHydrated();
  const [navOpen, setNavOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!hydrated) return;
    if (!user || user.role !== role) {
      router.replace("/login");
    }
  }, [hydrated, user, role, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="readout animate-pulse">{t("shell.loading")}</span>
      </div>
    );
  }

  if (!user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="readout">{t("shell.redirecting")}</span>
      </div>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) =>
    index === segments.length - 1 && crumbOverride ? crumbOverride : segment.replace(/-/g, " "),
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label={t("nav.primary")}>
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-white/[0.09] text-white"
                : "text-white/60 hover:bg-white/[0.06] hover:text-white/90"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                style={{ background: "var(--cyan)" }}
              />
            )}
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Navy rail. The chrome carries the product's identity so the clinical
          surfaces can stay white and high-contrast where the data lives. */}
      <aside className="navy-rail hidden w-60 flex-col p-4 sm:flex">
        <Link href="/" className="mb-1 flex items-center gap-2 px-2">
          <Mark className="h-5 w-5" onNavy />
          <span className="display text-lg text-white">MAYOQ AI</span>
        </Link>
        <div className="mb-6 px-2">
          <span className="readout text-white/45">{t(ROLE_KEY[role])}</span>
        </div>
        {nav}
        <div className="my-4 h-px bg-white/10" />
        <button
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
          className="rounded-md px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.06] hover:text-white/80"
        >
          {t("action.signOut")}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--surface)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-label={t("nav.toggle")}
              className="rounded border border-[color:var(--line)] px-2 py-1 font-mono text-[11px] text-ink-muted sm:hidden"
            >
              {t("nav.menu")}
            </button>
            <ol className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 && <span aria-hidden>/</span>}
                  <span className={index === crumbs.length - 1 ? "truncate text-ink-muted" : "hidden sm:inline"}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint sm:inline">
              {t(ROLE_KEY[role])}
            </span>
            <span className="hidden text-sm text-ink md:inline">{user.fullName}</span>
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-medium text-white"
              style={{ background: "linear-gradient(140deg, var(--electric), var(--signal))" }}
            >
              {initials(user.fullName)}
            </span>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {navOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="navy-rail overflow-hidden p-3 sm:hidden"
            >
              {nav}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative min-w-0 flex-1 p-4 sm:p-6">
          {/* Soft blurred ground, purely decorative. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[color:var(--electric)]/[0.07] blur-3xl" />
            <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[color:var(--signal)]/[0.06] blur-3xl" />
          </div>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/**
 * Mark: the MAYOQ lighthouse standing inside the M, its beams across the
 * horizon and a helix running down the tower. "Mayoq" is a lighthouse — the
 * product's whole job is to light the hazard before the ship reaches it, and
 * the helix is the patient it lights the way for.
 *
 * Drawn inline rather than pulled from /logo.svg so the mark can follow the
 * surface it sits on: on the navy rail the letterform lifts to near-white,
 * while the lamp keeps its gold everywhere.
 */
export function Mark({ className = "h-5 w-5", onNavy = false }: { className?: string; onNavy?: boolean }) {
  // Gradient ids are document-scoped and the shell paints the mark more than
  // once per page (header and footer), so each instance needs its own.
  const uid = useId().replace(/:/g, "");
  const url = (name: string) => "url(#" + name + "-" + uid + ")";
  const id = (name: string) => name + "-" + uid;
  const letterTop = onNavy ? "#EAF1FF" : "#20499C";
  const letterBottom = onNavy ? "#A6C2F2" : "#15306B";
  // The pale helix strand reads as the gap between the gold rungs, so on navy
  // it has to go dark rather than stay white.
  const strandPale = onNavy ? "#0B1419" : "#F3F7FF";

  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id={id("mqNavy")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={letterTop} />
          <stop offset="1" stopColor={letterBottom} />
        </linearGradient>
        <linearGradient id={id("mqGold")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="0.5" stopColor="#FFC81F" />
          <stop offset="1" stopColor="#F2A900" />
        </linearGradient>
        <linearGradient id={id("mqBeamL")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#FFC81F" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("mqBeamR")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFC81F" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("mqGlow")}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#FFE07A" />
          <stop offset="1" stopColor="#FFC81F" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id("mqTower")}>
          <path d="M28.4 15h7.2l1.6 29.6L32 56l-5.2-11.4z" />
        </clipPath>
      </defs>

      {/* The beams, widening as they leave the lens. */}
      <path d="M28.8 6.2 0.8 0.4 0.2 8.6 28.8 11.8z" fill={url("mqBeamL")} />
      <path d="M35.2 6.2 63.2 0.4 63.8 8.6 35.2 11.8z" fill={url("mqBeamR")} />

      {/* The letterform. */}
      <g fill={url("mqNavy")}>
        <path d="M6 56V18h11l15 30v8h-5L16 35v21z" />
        <path d="M58 56V18H47L32 48v8h5l11-21v21z" />
      </g>

      {/* The tower, with the helix running down inside it. */}
      <path d="M28.4 15h7.2l1.6 29.6L32 56l-5.2-11.4z" fill={url("mqNavy")} />
      <g clipPath={"url(#" + id("mqTower") + ")"} fill="none" strokeLinecap="round">
        <path d="M32 16c5 4 5 8 0 12s-5 8 0 12 5 8 0 12" stroke={url("mqGold")} strokeWidth="1.9" />
        <path d="M32 16c-5 4-5 8 0 12s5 8 0 12-5 8 0 12" stroke={strandPale} strokeWidth="1.9" />
        <path
          d="M29.6 19h4.8M28.6 22h6.8M29.6 25h4.8M29.6 31h4.8M28.6 34h6.8M29.6 37h4.8M29.6 43h4.8M28.6 46h6.8M30.2 49h3.6"
          stroke={url("mqGold")}
          strokeWidth="1.5"
        />
      </g>

      {/* Gallery, lantern room and roof. */}
      <rect x="26.2" y="12.6" width="11.6" height="2.8" rx="1.1" fill={url("mqNavy")} />
      <rect x="27.8" y="5.6" width="8.4" height="7.2" rx="1.2" fill={url("mqGold")} />
      <circle cx="32" cy="9.2" r="4.6" fill={url("mqGlow")} />
      <path d="M24.6 5.6 32 1.2l7.4 4.4z" fill={url("mqNavy")} />
      <circle cx="32" cy="0.9" r="0.9" fill={url("mqNavy")} />
    </svg>
  );
}
