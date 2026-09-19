"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { MarketingShell, PageHead } from "@/components/marketing/marketing-shell";
import { Reveal } from "@/components/ui/reveal";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";
import type { MessageKey } from "@/lib/locales/uz";

const PLANS: Array<{
  name: MessageKey;
  price: MessageKey;
  period: MessageKey;
  yearly: MessageKey;
  detail: MessageKey;
  /** The tier most clinics land on, called out so the grid has one focus. */
  featured?: boolean;
}> = [
  {
    name: "home.plan.start",
    price: "home.plan.startPrice",
    period: "home.plan.startPeriod",
    yearly: "home.plan.startYearly",
    detail: "home.plan.startDetail",
  },
  {
    name: "home.plan.plus",
    price: "home.plan.plusPrice",
    period: "home.plan.plusPeriod",
    yearly: "home.plan.plusYearly",
    detail: "home.plan.plusDetail",
    featured: true,
  },
  {
    name: "home.plan.enterprise",
    price: "home.plan.enterprisePrice",
    period: "home.plan.enterprisePeriod",
    yearly: "home.plan.enterpriseYearly",
    detail: "home.plan.enterpriseDetail",
  },
];

export default function PricingPage() {
  const { t, locale } = useI18n();
  const page = MARKETING_COPY[locale].pricing;

  return (
    <MarketingShell>
      <PageHead eyebrow={page.eyebrow} title={page.title} body={page.body} />

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.12em] text-signal">
          {t("home.planTrial")}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 80}
              className={`panel flex flex-col p-6 ${plan.featured ? "ring-1 ring-signal/40" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="readout">{t(plan.name)}</span>
                {plan.featured && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
                    {t("home.planPopular")}
                  </span>
                )}
              </div>
              <div className="mt-3 font-display text-[28px] text-ink">{t(plan.price)}</div>
              <div className="font-mono text-[11px] text-ink-faint">{t(plan.period)}</div>
              {/* The yearly figure is the same plan, so it sits under the
                  monthly price rather than taking a card of its own. */}
              <div className="mt-2 font-mono text-[11px] text-ink-muted">{t(plan.yearly)}</div>
              <p className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-muted">{t(plan.detail)}</p>
              <Link
                href="/register"
                className={`mt-6 rounded px-4 py-2 text-center text-sm transition ${
                  plan.featured
                    ? "bg-electric font-medium text-white hover:bg-electric/90"
                    : "border text-ink hover:bg-ink/[0.04]"
                }`}
                style={plan.featured ? undefined : { borderColor: "var(--line-strong)" }}
              >
                {page.cta}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <h2 className="display text-[26px] text-ink">{page.includedTitle}</h2>
            <ul className="mt-6 flex flex-col gap-3">
              {page.included.map((line) => (
                <li key={line} className="flex gap-3 text-[14px] leading-relaxed text-ink-muted">
                  <Check className="mt-[3px] h-4 w-4 shrink-0 text-state-green" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="display text-[26px] text-ink">{page.faqTitle}</h2>
            <div className="mt-6 divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {page.faq.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] text-ink">
                    {item.q}
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-ink-faint transition group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-3 max-w-readable text-[14px] leading-relaxed text-ink-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-6 py-10 text-xs leading-relaxed text-ink-faint">{t("home.disclaimer")}</p>
    </MarketingShell>
  );
}

