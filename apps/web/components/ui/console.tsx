"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { STATE_GLYPH, STATE_HEX, STATE_LABEL_KEY } from "@/components/digital-twin/anatomy";
import { useI18n } from "@/lib/i18n";
import type { RiskColor } from "@/components/digital-twin/types";

/* ---------------------------------------------------------------- header */

/**
 * Page header. Every console page opens the same way: what this is, who it is
 * for, and the one action worth taking from here.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="readout">{eyebrow}</span>
          <h1 className="display mt-2 text-[28px] leading-tight text-ink sm:text-[32px]">{title}</h1>
          {description && (
            <p className="mt-2 max-w-readable text-[14px] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {meta && (
        <>
          <div className="rail mt-5" />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">{meta}</div>
        </>
      )}
    </header>
  );
}

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="readout">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-ink-muted">{value}</span>
    </span>
  );
}

/* ----------------------------------------------------------------- queues */

type Tone = "neutral" | "amber" | "red";

/**
 * A queue, not a metric. A clinician opening this page needs to know what is
 * waiting for them and in what order — so each tile carries a count, the tone
 * that count earns, and the way in. An empty queue is calm on purpose: a zero
 * next to "New alerts" is good news, and colouring it red would cry wolf.
 */
export function QueueCard({
  label,
  count,
  hint,
  href,
  tone = "neutral",
  /**
   * A queue is work waiting; a stat is context. Only a queue can be "clear",
   * so only a queue turns green at zero — "Nothing waiting" under a panel size
   * would be nonsense.
   */
  kind = "queue",
  index = 0,
}: {
  label: string;
  count: number;
  hint: string;
  href: string;
  tone?: Tone;
  kind?: "queue" | "stat";
  index?: number;
}) {
  const { t } = useI18n();
  const isQueue = kind === "queue";
  const active = count > 0;
  const clear = isQueue && !active;
  const accent = clear
    ? "var(--state-green)"
    : !isQueue
      ? "var(--signal)"
      : tone === "red"
        ? "var(--state-red)"
        : tone === "amber"
          ? "var(--state-amber)"
          : "var(--signal)";

  return (
    <Link
      href={href}
      className="panel group relative block overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="readout">{label}</span>
        <span
          aria-hidden
          className="font-mono text-[11px] text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-signal"
        >
          →
        </span>
      </div>
      <div
        className="mt-3 font-display text-[34px] leading-none tabular-nums"
        style={{ color: isQueue && active ? accent : "var(--ink)" }}
      >
        {count}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-faint">
        {clear ? t("console.nothingWaiting") : hint}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------ risk ribbon */

/**
 * Risk distribution across a set of analyses, worst-first so the eye lands on
 * the problem. One bar carries more per pixel than a pie, and it reuses the
 * product's own colour semantics rather than inventing a chart palette.
 */
export function RiskRibbon({ counts }: { counts: Record<RiskColor, number> }) {
  const { t } = useI18n();
  const order: RiskColor[] = ["red", "yellow", "green"];
  const total = order.reduce((sum, key) => sum + counts[key], 0);

  if (total === 0) {
    return <p className="text-sm text-ink-faint">{t("console.noAnalysesInRange")}</p>;
  }

  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full"
        role="img"
        aria-label={order
          .filter((key) => counts[key] > 0)
          .map((key) => `${counts[key]} ${t(STATE_LABEL_KEY[key])}`)
          .join(", ")}
      >
        {order.map((key) =>
          counts[key] > 0 ? (
            <span
              key={key}
              style={{ background: STATE_HEX[key], width: `${(counts[key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {order.map((key) => (
          <li key={key} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="inline-flex h-4 w-4 translate-y-0.5 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: STATE_HEX[key] }}
            >
              {STATE_GLYPH[key]}
            </span>
            <span className="font-mono text-[15px] tabular-nums text-ink">{counts[key]}</span>
            <span className="text-[12px] text-ink-faint">{t(STATE_LABEL_KEY[key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------- distribution */

/**
 * Category distribution. Deliberately CSS bars rather than a charting library:
 * for a handful of named categories, inline labels and exact counts read more
 * precisely than an axis, and nothing here is a trend over time.
 */
export function DistributionBars({
  items,
}: {
  items: Array<{ label: string; count: number }>;
}) {
  const { t } = useI18n();
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">{t("console.nothingRecordedYet")}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
            {item.label.replace(/_/g, " ").toLowerCase()}
          </span>
          <span className="font-mono text-[13px] tabular-nums text-ink">{item.count}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
            <span
              className="block h-full rounded-full bg-signal/70 transition-[width] duration-700"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ panel shell */

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-3.5">
        <h2 className="readout">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 p-5">{children}</div>
    </section>
  );
}

/* --------------------------------------------------------- state displays */

/** An empty screen is an invitation to act, so it always names the next step. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-4">
      <h3 className="font-display text-[15px] text-ink">{title}</h3>
      <p className="max-w-readable text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {action}
    </div>
  );
}

/** Skeletons hold the layout so nothing jumps when the data lands. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={t("console.loading")}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-9 animate-pulse rounded bg-ink/[0.05]"
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  );
}

/** Dense, scannable row used by every list on the console. */
export function Row({
  primary,
  secondary,
  trailing,
  href,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex items-center justify-between gap-4 rounded px-3 py-2.5 transition hover:bg-ink/[0.03]">
      <div className="min-w-0">
        <div className="truncate text-[14px] text-ink">{primary}</div>
        {secondary && (
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-ink-faint">{secondary}</div>
        )}
      </div>
      {trailing}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ------------------------------------------------------------------ tabs */

export interface TabDef {
  id: string;
  label: string;
  /** Shown beside the label when there is something to count. */
  count?: number;
}

/**
 * Section switcher for a page that holds several distinct jobs.
 *
 * A patient chart is not one task: reading the record, running a projection,
 * and reviewing prevention are separate things a doctor does at separate
 * moments. Stacking them made one page eight screens tall, where the cost of
 * every section was paid on every visit. Each tab is one job.
 *
 * Arrow keys move between tabs, matching how a tablist is expected to behave.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { t } = useI18n();

  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.id === active);
    const next = (current + step + tabs.length) % tabs.length;
    onChange(tabs[next].id);
  }

  return (
    <div
      role="tablist"
      aria-label={t("console.chartSections")}
      onKeyDown={onKeyDown}
      className={`flex items-stretch gap-1 overflow-x-auto border-b border-[color:var(--line)] ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className="group relative shrink-0 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition"
            style={{ color: selected ? "var(--ink)" : "var(--ink-faint)" }}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="readout-value text-[10px] text-ink-faint">{tab.count}</span>
              )}
            </span>
            {/* The lamp marks where you are. */}
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-px h-[2px] transition"
              style={{ background: selected ? "var(--lamp)" : "transparent" }}
            />
          </button>
        );
      })}
    </div>
  );
}
