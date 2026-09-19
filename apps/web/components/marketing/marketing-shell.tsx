"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Mark } from "@/components/ui/app-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";

const LINKS = [
  { href: "/features", key: "features" },
  { href: "/how-it-works", key: "how" },
  { href: "/pricing", key: "pricing" },
  { href: "/about", key: "about" },
] as const;

/** Shared chrome for every public page, so the landing page and its siblings read as one site. */
export function MarketingShell({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const copy = MARKETING_COPY[locale];
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] transition ${
      pathname === href ? "text-signal" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap" aria-label="MAYOQ AI">
            <Mark />
            <span className="display text-lg text-ink">MAYOQ AI</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-5 lg:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass(link.href)}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {copy.nav[link.key]}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link href="/login" className={`${linkClass("/login")} hidden sm:inline`}>
              {t("home.signIn")}
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded border border-signal/40 bg-signal/[0.08] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-signal transition hover:bg-signal/15"
            >
              {t("home.startDemo")}
            </Link>
          </div>
        </div>

        {/* Below md the links drop to their own scrollable row. */}
        <nav
          aria-label="Primary"
          className="flex gap-6 overflow-x-auto border-t border-[color:var(--line)] px-6 py-2.5 lg:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {copy.nav[link.key]}
            </Link>
          ))}
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Mark />
              <span className="display text-base text-ink">MAYOQ AI</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-muted">{copy.footer.line}</p>
          </div>
          <div>
            <span className="readout">{copy.footer.product}</span>
            <ul className="mt-3 flex flex-col gap-2">
              {LINKS.slice(0, 3).map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13px] text-ink-muted transition hover:text-ink">
                    {copy.nav[link.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="readout">{copy.footer.company}</span>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link href="/about" className="text-[13px] text-ink-muted transition hover:text-ink">
                  {copy.nav.about}
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-[13px] text-ink-muted transition hover:text-ink">
                  {t("home.signIn")}
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-[13px] text-ink-muted transition hover:text-ink">
                  {t("home.startDemo")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[color:var(--line)]">
          <p className="mx-auto max-w-6xl px-6 py-4 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {copy.footer.legal}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Heading block used at the top of each sub-page. */
export function PageHead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-14 pt-16">
      <div className="rise max-w-3xl">
        <span className="readout">{eyebrow}</span>
        <h1 className="display mt-4 text-[36px] leading-[1.05] text-ink sm:text-[52px]">{title}</h1>
        <p className="mt-5 max-w-readable text-[16px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </section>
  );
}
