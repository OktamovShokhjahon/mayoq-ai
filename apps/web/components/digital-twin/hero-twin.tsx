"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BodyDiagram } from "./body-diagram";
import { DEMO_AFTER, DEMO_BEFORE, DEMO_PATIENT, DEMO_TIMELINE } from "./demo-scenario";
import { ORGAN_BY_KEY, organLabelKey } from "./anatomy";
import { OrganLabels, type Projection } from "./organ-labels";
import { ZoomControls } from "./zoom-controls";
import type { ZoomApi } from "./body-scene";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

const BodyScene = dynamic(() => import("./body-scene").then((m) => m.BodyScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ink/[0.035]" />,
});

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/** The checkpoint the current blend is sitting closest to. */
function stopNearest(mix: number) {
  return DEMO_TIMELINE.reduce((best, stop) =>
    Math.abs(stop.mix - mix) < Math.abs(best.mix - mix) ? stop : best
  );
}

/**
 * Landing hero. The twin plays itself forward across the projection horizon
 * until someone takes the timeline, which is the one thing about this product
 * that cannot be explained faster in words than it can be shown.
 */
export function HeroTwin() {
  const reducedMotion = usePrefersReducedMotion();
  const { t } = useI18n();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mix, setMix] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const zoomApi = useRef<ZoomApi | null>(null);
  const [zoom, setZoom] = useState(1);
  /** Day the viewer pinned, or null while the horizon plays on its own. */
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);
  const mixRef = useRef(0);
  const projection = useRef<Projection>({});

  useEffect(() => {
    setSupported(detectWebGL() && window.innerWidth >= 640);
  }, []);

  useEffect(() => {
    const pinned = pinnedDay === null ? null : DEMO_TIMELINE.find((s) => s.day === pinnedDay);

    if (reducedMotion) {
      const target = pinned ? pinned.mix : 1;
      mixRef.current = target;
      setMix(target);
      return;
    }

    let frame = 0;
    let raf = 0;
    const tick = () => {
      // 5s hold at each end, 2s transition between them — unless the viewer
      // has pinned a day, in which case that day is the only target.
      let target: number;
      if (pinned) {
        target = pinned.mix;
      } else {
        frame += 1;
        const cycle = frame % 780;
        target =
          cycle < 300
            ? 0
            : cycle < 420
              ? (cycle - 300) / 120
              : cycle < 720
                ? 1
                : 1 - (cycle - 720) / 60;
      }
      target = Math.min(1, Math.max(0, target));

      // Easing the blend rather than assigning it keeps the organs from
      // snapping when the viewer jumps between two distant days.
      const next = mixRef.current + (target - mixRef.current) * 0.08;
      mixRef.current = Math.abs(target - next) < 0.001 ? target : next;
      setMix(mixRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, pinnedDay]);

  // Day labels are derived, not stored: the scenario data holds the number,
  // and the number is what a translation needs.
  const stopLabel = (day: number) =>
    day === 0 ? t("twin.today") : t("twin.dayN", { n: day });

  // The demo scenario stores message keys rather than prose, so it is
  // translated here, once, before anything downstream renders it.
  const localise = useCallback(
    (list: typeof DEMO_BEFORE) =>
      list.map((signal) => ({
        ...signal,
        explanation: t(signal.explanation as MessageKey),
        missingData: signal.missingData.map((field) => t(field as MessageKey)),
      })),
    [t],
  );
  const beforeSignals = useMemo(() => localise(DEMO_BEFORE), [localise]);
  const afterSignals = useMemo(() => localise(DEMO_AFTER), [localise]);

  const pinnedStop = DEMO_TIMELINE.find((s) => s.day === pinnedDay);
  const activeStop = pinnedStop ?? stopNearest(mix);
  const signals = mix > 0.5 ? afterSignals : beforeSignals;
  const active = selected ? signals.find((signal) => signal.organ === selected) : null;

  const onTimelineKey = useCallback((event: React.KeyboardEvent) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    setPinnedDay((day) => {
      const index = DEMO_TIMELINE.findIndex((s) => s.day === day);
      const from =
        index === -1
          ? DEMO_TIMELINE.findIndex((s) => s.day === stopNearest(mixRef.current).day)
          : index;
      const next = Math.min(DEMO_TIMELINE.length - 1, Math.max(0, from + step));
      return DEMO_TIMELINE[next].day;
    });
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-[color:var(--console)]"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="h-[520px] w-full sm:h-[660px]">
        {supported === null ? (
          <div className="h-full w-full animate-pulse bg-ink/[0.035]" />
        ) : supported ? (
          <BodyScene
            beforeSignals={beforeSignals}
            afterSignals={afterSignals}
            mix={mix}
            view="front"
            sex="male"
            projection={projection}
            autoRotate
            reducedMotion={reducedMotion}
            selectedOrgan={selected}
            onSelectOrgan={setSelected}
            zoomApi={zoomApi}
            onZoomChange={setZoom}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <BodyDiagram signals={signals} selectedOrgan={selected} onSelectOrgan={setSelected} />
          </div>
        )}
      </div>

      {supported && (
        <OrganLabels
          signals={signals}
          projection={projection}
          selectedOrgan={selected}
          onSelectOrgan={setSelected}
        />
      )}

      {/* Instrument chrome */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1">
        <span className="readout">{DEMO_PATIENT.code} · {t("demo.synthetic")}</span>
        <span className="font-mono text-[11px] tracking-[0.1em]" style={{ color: "var(--cyan)" }}>
          {activeStop.day === 0 ? t("twin.current") : t("twin.projected")} · {t("twin.day")}{" "}
          {activeStop.day}
        </span>
        {/* Says which of the two things is on screen, so the exploded view is
            never mistaken for the body itself. */}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          {zoom >= 1.6 ? t("twin.separated") : t("twin.wholeBody")}
        </span>
      </div>

      {supported && (
        <div className="absolute right-4 top-4">
          <ZoomControls api={zoomApi} zoom={zoom} onNavy />
        </div>
      )}

      {active && (
        <div
          className="absolute bottom-[140px] left-4 max-w-xs rounded border bg-surface/95 p-3 backdrop-blur"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <div className="font-display text-sm text-ink">
            {ORGAN_BY_KEY[active.organ] ? t(organLabelKey(active.organ)) : active.organ}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{active.explanation}</p>
        </div>
      )}

      {/* Horizon timeline. The days are a real sequence, so they are ordered
          and labelled by day; picking one pins the twin to that point. */}
      <div
        className="absolute inset-x-0 bottom-0 border-t bg-[color:var(--console)]/85 px-4 pb-3 pt-3 backdrop-blur"
        style={{ borderColor: "rgba(53, 208, 224, 0.18)" }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="readout">{t("twin.horizon")}</span>
          <button
            type="button"
            onClick={() => setPinnedDay(null)}
            aria-pressed={pinnedDay === null}
            className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition"
            style={{
              color: pinnedDay === null ? "var(--cyan)" : "var(--ink-faint)",
              background: pinnedDay === null ? "rgba(53, 208, 224, 0.12)" : "transparent",
            }}
          >
            {pinnedDay === null ? t("twin.playing") : t("twin.play")}
          </button>
        </div>

        <div
          role="group"
          aria-label={t("twin.horizon")}
          onKeyDown={onTimelineKey}
          className="relative mt-3 flex items-start justify-between"
        >
          {/* Track sits behind the nodes, aligned to their centres. */}
          <div className="pointer-events-none absolute inset-x-0 top-[5px] h-px bg-white/10" />
          <div
            className="pointer-events-none absolute left-0 top-[5px] h-px"
            style={{ width: `${mix * 100}%`, background: "var(--cyan)" }}
          />

          {DEMO_TIMELINE.map((stop) => {
            const reached = mix >= stop.mix - 0.02;
            const current = activeStop.day === stop.day;
            return (
              <button
                key={stop.day}
                type="button"
                onClick={() => setPinnedDay(stop.day)}
                aria-pressed={current}
                aria-label={`${stopLabel(stop.day)}: ${t(stop.note)}`}
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
                  className="font-mono text-[10px] uppercase tracking-[0.12em] transition"
                  style={{ color: current ? "var(--cyan)" : "var(--ink-faint)" }}
                >
                  {stopLabel(stop.day)}
                </span>
              </button>
            );
          })}
        </div>

        <p
          className="mt-2.5 min-h-[32px] max-w-xl text-[12px] leading-relaxed"
          style={{ color: "#b6c6d6" }}
        >
          {t(activeStop.note)}
        </p>
      </div>
    </div>
  );
}
