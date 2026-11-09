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
  /**
   * Rarely needed. The rail already names the role and the breadcrumb already
   * names the section, so an eyebrow reading "Doctor console" above a doctor
   * page is the third statement of one fact and the first thing the eye hits.
   * Pass it only where the page's context is not otherwise on screen.
   */
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <span className="readout">{eyebrow}</span>}
          <h1
            className={`display text-[26px] leading-[1.12] text-ink sm:text-[31px] ${eyebrow ? "mt-2" : ""}`}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-readable text-[15px] leading-relaxed text-ink-muted">
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

/**
 * Context in the header rail. Label and value sit on one line: stacked, three
 * of them read as three small columns of equal importance to the page title,
 * which is not what a page's supporting counts are.
 */
export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-[13px] text-ink-faint">{label}</span>
      <span className="readout-value text-[13px] text-ink-muted">{value}</span>
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
export interface QueueDef {
  label: string;
  count: number;
  hint: string;
  href: string;
  tone?: Tone;
}

/**
 * The triage band: what is waiting, and nothing else.
 *
 * This used to be four equal tiles. Three of them routinely read zero, and an
 * empty queue took exactly as much space and contrast as the one queue with
 * work in it — so the page promised triage in its headline and delivered a
 * grid the clinician had to read in full to find the single number that
 * mattered. On a phone you scrolled two screens of "nothing waiting" first.
 *
 * So: a queue with work in it gets a lit card. Queues at zero are good news,
 * and good news is one quiet line naming them, not three cards. If everything
 * is clear the band is a single line and the page starts at the work below.
 */
export function TriageBand({ queues }: { queues: QueueDef[] }) {
  const { t } = useI18n();
  const active = queues.filter((queue) => queue.count > 0);
  const clear = queues.filter((queue) => queue.count === 0);

  return (
    <div className="flex flex-col gap-3">
      {active.length > 0 && (
        <div
          className={`grid gap-3 ${
            active.length === 1 ? "" : active.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
          }`}
        >
          {active.map((queue) => (
            <LiveQueue key={queue.label} {...queue} wide={active.length === 1} />
          ))}
        </div>
      )}

      {clear.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-faint">
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-state-green/15 text-[9px] font-bold text-state-green"
          >
            ✓
          </span>
          <span>
            {t("console.clearQueues")}{" "}
            <span className="text-ink-muted">
              {clear.map((queue) => queue.label.toLocaleLowerCase()).join(", ")}
            </span>
          </span>
        </p>
      )}
    </div>
  );
}

/** One queue that has work in it. The only lit thing in the band. */
function LiveQueue({
  label,
  count,
  hint,
  href,
  tone = "neutral",
  wide,
}: QueueDef & { wide?: boolean }) {
  const accent =
    tone === "red" ? "var(--state-red)" : tone === "amber" ? "var(--state-amber)" : "var(--signal)";

  return (
    <Link
      href={href}
      className="panel-live group flex items-center gap-4 overflow-hidden p-5 transition hover:-translate-y-0.5"
    >
      <span
        className="font-display text-[39px] leading-none tabular-nums"
        style={{ color: accent }}
      >
        {count}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight text-ink">{label}</span>
        <span className={`mt-1 block text-[13px] leading-snug text-ink-faint ${wide ? "" : "line-clamp-2"}`}>
          {hint}
        </span>
      </span>
    </Link>
  );
}

/**
 * Supporting counts. Not a queue and not a card: nothing here is waiting on
 * anyone, so it reads as a line of context under the band.
 */
export function ContextStats({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-baseline gap-2">
          <dt className="text-[13px] text-ink-faint">{item.label}</dt>
          <dd className="readout-value text-[13px] text-ink-muted">{item.value}</dd>
        </span>
      ))}
    </dl>
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
  /**
   * How much light this surface earns. "quiet" is for context the reader
   * passes over — a legend, a standing note — which previously looked
   * identical to the panel holding the actual work.
   */
  tier = "default",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tier?: "default" | "quiet";
}) {
  const quiet = tier === "quiet";
  return (
    <section className={`${quiet ? "panel-quiet" : "panel"} flex flex-col ${className}`}>
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3"
        style={{ borderColor: quiet ? "var(--line-quiet)" : "var(--line)" }}
      >
        <h2 className="label">{title}</h2>
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
  marker,
  href,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  /**
   * A fixed-width slot at the left edge. Risk is the most scannable thing in
   * a clinical list, but as a variable-width pill on the right it left the
   * rows ragged and gave the eye no column to run down. In the gutter it
   * lines up, and the row's text starts at one consistent indent.
   */
  marker?: ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-3 rounded px-3 py-2.5 transition hover:bg-ink/[0.03]">
      {marker !== undefined && (
        <span className="flex w-5 shrink-0 justify-center">{marker}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-ink">{primary}</div>
        {secondary && (
          <div className="mt-0.5 text-[12px] text-ink-faint">{secondary}</div>
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
            // Sans, sentence case: a tab label is a place name, not a reading.
            className="group relative shrink-0 px-3.5 py-2.5 text-[14px] transition"
            style={{
              color: selected ? "var(--ink)" : "var(--ink-faint)",
              fontWeight: selected ? 600 : 400,
            }}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="readout-value rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[10px] text-ink-muted">
                  {tab.count}
                </span>
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
