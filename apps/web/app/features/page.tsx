"use client";

import Link from "next/link";
import { Activity, FileSearch, Languages, Scale, ScanSearch, ShieldCheck } from "lucide-react";
import { MarketingShell, PageHead } from "@/components/marketing/marketing-shell";
import { SampleCases } from "@/components/marketing/sample-cases";
import { OrganCoverage } from "@/components/marketing/organ-coverage";
import { Reveal } from "@/components/ui/reveal";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";

/** Same order as `features.items` in the copy. */
const ICONS = [FileSearch, ShieldCheck, Scale, ScanSearch, Activity, Languages];

export default function FeaturesPage() {
  const { locale, t } = useI18n();
  const copy = MARKETING_COPY[locale];
  const page = copy.features;

  return (
    <MarketingShell>
      <PageHead eyebrow={page.eyebrow} title={page.title} body={page.body} />

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <ul className="grid gap-px overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((item, index) => {
            const Icon = ICONS[index] ?? FileSearch;
            return (
              <Reveal as="li" key={item.title} delay={index * 60} className="bg-surface p-6">
                <Icon className="h-5 w-5 text-signal" aria-hidden />
                <h2 className="display mt-4 text-[18px] text-ink">{item.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{item.body}</p>
              </Reveal>
            );
          })}
        </ul>
      </section>

      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <span className="readout">{t("home.organsEyebrow")}</span>
            <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
              {t("home.organsTitle")}
            </h2>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <OrganCoverage />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">{copy.cases.eyebrow}</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            {copy.cases.title}
          </h2>
          <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            {copy.cases.body}
          </p>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <SampleCases />
        </Reveal>
      </section>

      <section className="border-t border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="display text-[26px] text-ink">{page.compareTitle}</h2>
          </Reveal>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color:var(--line-strong)]">
                  <th scope="col" className="w-1/5 py-3 pr-4" />
                  <th scope="col" className="readout py-3 pr-4">{page.usual}</th>
                  <th scope="col" className="readout py-3 text-signal">MAYOQ AI</th>
                </tr>
              </thead>
              <tbody>
                {page.compareRows.map((row) => (
                  <tr key={row.label} className="border-b border-[color:var(--line)] align-top">
                    <th scope="row" className="py-4 pr-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                      {row.label}
                    </th>
                    <td className="py-4 pr-4 text-[14px] text-ink-muted">{row.usual}</td>
                    <td className="py-4 text-[14px] text-ink">{row.mayoq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel mt-14 flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="max-w-readable text-[16px] text-ink">{page.ctaTitle}</p>
            <Link
              href="/register"
              className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
            >
              {page.cta}
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
