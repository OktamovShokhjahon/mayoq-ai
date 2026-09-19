"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { MarketingShell, PageHead } from "@/components/marketing/marketing-shell";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";

export default function HowItWorksPage() {
  const { locale } = useI18n();
  const page = MARKETING_COPY[locale].how;
  const reduce = useReducedMotion();

  return (
    <MarketingShell>
      <PageHead eyebrow={page.eyebrow} title={page.title} body={page.body} />

      <section className="mx-auto max-w-6xl px-6 pb-20">
        {/* The steps really are sequential, so this is an ordered list on a rail. */}
        <ol className="relative border-l pl-8 sm:pl-12" style={{ borderColor: "var(--line-strong)" }}>
          {page.steps.map((step, index) => (
            <motion.li
              key={step.title}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative pb-12 last:pb-0"
            >
              <span
                aria-hidden
                className="absolute -left-[45px] top-0 flex h-7 w-7 items-center justify-center rounded-full border bg-paper font-mono text-[11px] text-signal sm:-left-[61px]"
                style={{ borderColor: "var(--signal)" }}
              >
                {index + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="display text-[22px] text-ink">{step.title}</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {step.actor}
                </span>
              </div>
              <p className="mt-2 max-w-readable text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-14">
          <div className="flex max-w-2xl gap-4">
            <Lock className="mt-1 h-5 w-5 shrink-0 text-signal" aria-hidden />
            <div>
              <h2 className="display text-[22px] text-ink">{page.guardTitle}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{page.guardBody}</p>
            </div>
          </div>
          <Link
            href="/features"
            className="rounded border px-5 py-2.5 text-sm text-ink transition hover:bg-ink/[0.04]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            {page.cta}
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
