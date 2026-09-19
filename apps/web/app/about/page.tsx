"use client";

import Link from "next/link";
import { MarketingShell, PageHead } from "@/components/marketing/marketing-shell";
import { Reveal } from "@/components/ui/reveal";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";

export default function AboutPage() {
  const { locale } = useI18n();
  const page = MARKETING_COPY[locale].about;

  return (
    <MarketingShell>
      <PageHead eyebrow={page.eyebrow} title={page.title} body={page.body} />

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="display text-[26px] text-ink">{page.principlesTitle}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {page.principles.map((item, index) => (
            <Reveal key={item.title} delay={index * 70} className="panel p-6">
              <h3 className="display text-[18px] text-ink">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-14">
          <div className="max-w-2xl">
            <span className="readout">{page.nameTitle}</span>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{page.nameBody}</p>
          </div>
          <Link
            href="/register"
            className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {page.cta}
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
