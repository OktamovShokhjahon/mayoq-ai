"use client";

import Link from "next/link";
import { HeroTwin } from "@/components/digital-twin/hero-twin";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SampleCases } from "@/components/marketing/sample-cases";
import { Reveal } from "@/components/ui/reveal";
import { OrganCoverage } from "@/components/marketing/organ-coverage";
import { ProvenanceChip, gradeDescriptionKey } from "@/components/ui/provenance-chip";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";
import type { MessageKey } from "@/lib/locales/uz";
import type { EvidenceGrade } from "@/components/digital-twin/types";

/**
 * The page's content is message keys rather than prose. A marketing page that
 * stays English while the console switches to Uzbek is the most visible way an
 * i18n setup can look broken, so the landing page is translated like any other
 * surface.
 */
const PIPELINE: Array<{ stage: MessageKey; detail: MessageKey }> = [
  { stage: "home.stage.intake", detail: "home.stage.intakeDetail" },
  { stage: "home.stage.extraction", detail: "home.stage.extractionDetail" },
  { stage: "home.stage.verification", detail: "home.stage.verificationDetail" },
  { stage: "home.stage.rules", detail: "home.stage.rulesDetail" },
  { stage: "home.stage.explanation", detail: "home.stage.explanationDetail" },
  { stage: "home.stage.scenario", detail: "home.stage.scenarioDetail" },
];

const GRADE_ORDER: EvidenceGrade[] = [
  "verified",
  "ai_unverified",
  "clinical_rule",
  "ai_interpretation",
  "projection",
];

const ROLES: Array<{
  role: MessageKey;
  sees: MessageKey;
  points: MessageKey[];
  limit: MessageKey;
}> = [
  {
    role: "role.admin",
    sees: "home.role.adminSees",
    points: ["home.role.adminP1", "home.role.adminP2", "home.role.adminP3"],
    limit: "home.role.adminLimit",
  },
  {
    role: "role.doctor",
    sees: "home.role.doctorSees",
    points: ["home.role.doctorP1", "home.role.doctorP2", "home.role.doctorP3"],
    limit: "home.role.doctorLimit",
  },
  {
    role: "role.patient",
    sees: "home.role.patientSees",
    points: ["home.role.patientP1", "home.role.patientP2", "home.role.patientP3"],
    limit: "home.role.patientLimit",
  },
];

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

const LIMITS: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: "home.limit1", body: "home.limit1Body" },
  { title: "home.limit2", body: "home.limit2Body" },
  { title: "home.limit3", body: "home.limit3Body" },
];

const STATS: Array<{ label: MessageKey; value: MessageKey }> = [
  { label: "home.statScope", value: "home.statScopeValue" },
  { label: "home.statRoles", value: "home.statRolesValue" },
  { label: "home.statResult", value: "home.statResultValue" },
];

export default function LandingPage() {
  const { t, locale } = useI18n();
  const cases = MARKETING_COPY[locale].cases;

  return (
    <MarketingShell>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-24 pt-12 lg:grid-cols-[1fr_1.05fr]">
        <div className="rise">
          <span className="readout">{t("home.heroEyebrow")}</span>
          {/* The headline breaks across three translated fragments rather than
              one string with hard-coded line breaks: the phrase that carries
              the emphasis is not in the same position in every language. */}
          <h1 className="display mt-4 text-[40px] leading-[1.03] text-ink sm:text-[54px]">
            {t("home.heroTitle1")}
            <br />
            <span className="text-signal">{t("home.heroTitle2")}</span>
            <br />
            {t("home.heroTitle3")}
          </h1>
          <p className="mt-6 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            {t("home.heroBody")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
            >
              {t("home.ctaDemo")}
            </Link>
            <Link
              href="/login"
              className="rounded border px-5 py-2.5 text-sm text-ink transition hover:bg-ink/[0.04]"
              style={{ borderColor: "var(--line-strong)" }}
            >
              {t("home.signIn")}
            </Link>
          </div>

          <div className="rail mt-10" />

          <dl className="mt-6 grid grid-cols-3 gap-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="readout">{t(stat.label)}</dt>
                <dd className="mt-1 font-mono text-[12px] text-ink-muted">{t(stat.value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rise" style={{ animationDelay: "140ms" }}>
          <HeroTwin />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {t("home.heroCaption")}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- Sample cases */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <span className="readout">{cases.eyebrow}</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            {cases.title}
          </h2>
          <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            {cases.body}
          </p>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <SampleCases />
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- Organs */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <span className="readout">{t("home.organsEyebrow")}</span>
            <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
              {t("home.organsTitle")}
            </h2>
            <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
              {t("home.organsBody")}
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <OrganCoverage />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------- Evidence taxonomy */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">{t("home.evidenceEyebrow")}</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            {t("home.evidenceTitle")}
          </h2>
          <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            {t("home.evidenceBody")}
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-2 lg:grid-cols-5">
          {GRADE_ORDER.map((grade, index) => (
            <Reveal as="li" key={grade} delay={index * 70} className="bg-surface p-5">
              <ProvenanceChip grade={grade} />
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                {t(gradeDescriptionKey(grade))}.
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ Pipeline */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <span className="readout">{t("home.pipelineEyebrow")}</span>
            <h2 className="display mt-3 text-[28px] leading-tight text-ink sm:text-[34px]">
              {t("home.pipelineTitle")}
            </h2>
            <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
              {t("home.pipelineBody1")}{" "}
              <span className="font-mono text-ink">{t("home.pipelineUnknown")}</span>{" "}
              {t("home.pipelineBody2")}
            </p>
          </Reveal>

          {/* The pipeline is genuinely ordered, so it renders as a rail. */}
          <ol className="relative border-l pl-8" style={{ borderColor: "var(--line-strong)" }}>
            {PIPELINE.map((step, index) => (
              <Reveal as="li" key={step.stage} delay={index * 80} className="relative pb-8 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -left-[37px] top-1.5 h-2 w-2 rounded-full bg-signal ring-4 ring-paper-deep"
                />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-signal">
                  {t(step.stage)}
                </h3>
                <p className="mt-1.5 max-w-readable text-[14px] leading-relaxed text-ink-muted">
                  {t(step.detail)}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------------- Roles */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">{t("home.rolesEyebrow")}</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            {t("home.rolesTitle")}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {ROLES.map((item, index) => (
            <Reveal
              key={item.role}
              delay={index * 90}
              className="panel flex flex-col p-6 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="readout">{t(item.role)}</span>
              <h3 className="display mt-2 text-[19px] leading-snug text-ink">{t(item.sees)}</h3>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {item.points.map((point) => (
                  <li key={point} className="flex gap-2 text-[14px] leading-relaxed text-ink-muted">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {t(point)}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-faint">
                {t(item.limit)}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- Limits */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <span className="readout">{t("home.limitsEyebrow")}</span>
          </Reveal>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {LIMITS.map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <h3 className="display text-[17px] text-ink">{t(item.title)}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{t(item.body)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">{t("home.pricingEyebrow")}</span>
          <h2 className="display mt-3 text-[28px] leading-tight text-ink sm:text-[34px]">
            {t("home.pricingTitle")}
          </h2>
        </Reveal>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-signal">
          {t("home.planTrial")}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 90}
              className={`panel p-6 transition hover:-translate-y-1 hover:shadow-lg ${
                plan.featured ? "ring-1 ring-signal/40" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="readout">{t(plan.name)}</span>
                {plan.featured && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
                    {t("home.planPopular")}
                  </span>
                )}
              </div>
              <div className="mt-3 font-display text-[26px] text-ink">{t(plan.price)}</div>
              <div className="font-mono text-[11px] text-ink-faint">{t(plan.period)}</div>
              {/* The yearly figure is the same plan, so it sits under the
                  monthly price rather than taking a card of its own. */}
              <div className="mt-2 font-mono text-[11px] text-ink-muted">{t(plan.yearly)}</div>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">{t(plan.detail)}</p>
            </Reveal>
          ))}
        </div>

        <Reveal
          delay={120}
          className="panel mt-12 flex flex-wrap items-center justify-between gap-4 p-6"
        >
          <p className="max-w-readable text-[15px] text-ink">{t("home.registerPrompt")}</p>
          <Link
            href="/register"
            className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            {t("home.registerCta")}
          </Link>
        </Reveal>

        <p className="mt-10 max-w-readable text-xs leading-relaxed text-ink-faint">
          {t("home.disclaimer")}
        </p>
      </section>
    </MarketingShell>
  );
}
