"use client";

import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";

export interface HorizonStop {
  /** 0 is the verified baseline; anything else is a projected horizon. */
  days: number;
}

/**
 * The projection horizon as a line rather than a row of buttons. Days are a
 * real sequence, and reading them as one — baseline on the left, the furthest
 * projection on the right — is what tells a doctor whether the twin is showing
 * the patient now or a forecast, which a set of equal-looking buttons does not.
 *
 * It sits inside the stage so the day being shown is next to the body showing
 * it, and the arrow keys walk the horizon without reaching for the mouse.
 */
export function HorizonTimeline({
  horizons,
  activeDays,
  /** 0 at the verified baseline, 1 at the projection. */
  mix,
  onSelect,
}: {
  horizons: number[];
  activeDays: number;
  mix: number;
  onSelect: (days: number) => void;
}) {
  const { t } = useI18n();

  // The baseline is a stop of its own: it is a state of the patient, not a
  // horizon, and it has to be reachable from the same line.
  const stops: HorizonStop[] = [{ days: 0 }, ...horizons.map((days) => ({ days }))];
  const activeIndex = mix <= 0.5 ? 0 : Math.max(1, stops.findIndex((s) => s.days === activeDays));
  const label = (days: number) =>
    days === 0
      ? t("twin.today")
      : days >= 365
        ? t("analysis.oneYear")
        : t("analysis.days", { n: days });

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = Math.min(stops.length - 1, Math.max(0, activeIndex + step));
      onSelect(stops[next].days);
    },
    [activeIndex, onSelect, stops],
  );

  // The filled part of the track follows the blend, so a half-morphed twin
  // reads as being between two points rather than sitting on one.
  const span = stops.length - 1 || 1;
  const progress =
    activeIndex === 0 ? 0 : ((activeIndex - 1 + Math.min(1, mix)) / span) * 100;

  return (
    <div
      className="absolute inset-x-0 bottom-0 border-t bg-[color:var(--console)]/85 px-4 pb-3 pt-2.5 backdrop-blur"
      style={{ borderColor: "rgba(53, 208, 224, 0.18)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="readout">{t("twin.horizon")}</span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: activeIndex === 0 ? "var(--ink-faint)" : "var(--cyan)" }}
        >
          {activeIndex === 0 ? t("twin.current") : t("twin.projected")}
        </span>
      </div>

      <div
        role="group"
        aria-label={t("twin.horizon")}
        onKeyDown={onKeyDown}
        className="relative mt-3 flex items-start justify-between"
      >
        {/* Track sits behind the nodes, aligned to their centres. */}
        <div className="pointer-events-none absolute inset-x-0 top-[5px] h-px bg-white/10" />
        <div
          className="pointer-events-none absolute left-0 top-[5px] h-px"
          style={{ width: `${progress}%`, background: "var(--cyan)" }}
        />

        {stops.map((stop, index) => {
          const current = index === activeIndex;
          const reached = index <= activeIndex;
          return (
            <button
              key={stop.days}
              type="button"
              onClick={() => onSelect(stop.days)}
              aria-pressed={current}
              aria-label={label(stop.days)}
              className="relative z-10 flex flex-col items-center gap-2 px-1"
            >
              <span
                className="block h-[11px] w-[11px] rounded-full border transition"
                style={{
                  borderColor: reached ? "var(--cyan)" : "rgba(255,255,255,0.45)",
                  background: reached ? "var(--cyan)" : "rgba(255,255,255,0.10)",
                  boxShadow: current ? "0 0 0 4px rgba(53, 208, 224, 0.22)" : "none",
                }}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums transition"
                style={{ color: current ? "var(--cyan)" : "var(--ink-faint)" }}
              >
                {label(stop.days)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
