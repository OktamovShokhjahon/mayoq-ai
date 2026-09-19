"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { OrganMap } from "./organ-map";
import { BodyDiagram } from "./body-diagram";
import { STATE_GLYPH, STATE_HEX, STATE_LABEL_KEY, type Sex } from "./anatomy";
import { OrganLabels, type Projection } from "./organ-labels";
import type { OrganSignal, RiskColor } from "./types";
import type { TwinView, ZoomApi } from "./body-scene";
import { ZoomControls } from "./zoom-controls";
import { HorizonTimeline } from "./horizon-timeline";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { formatDateTime } from "@/lib/format";
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

const VIEWS: Array<{ id: TwinView; label: MessageKey }> = [
  { id: "front", label: "twin.front" },
  { id: "back", label: "twin.back" },
  { id: "left", label: "twin.left" },
  { id: "right", label: "twin.right" },
];

/** Worst state wins, so the summary never reads calmer than the anatomy. */
function overallOf(signals: OrganSignal[]): RiskColor {
  if (signals.some((signal) => signal.color === "red")) return "red";
  if (signals.some((signal) => signal.color === "yellow")) return "yellow";
  return "green";
}

export function DigitalTwinViewer({
  beforeSignals,
  afterSignals,
  horizonDays,
  sex = "male",
  horizons,
  onHorizonChange,
  analysisMeta,
}: {
  beforeSignals: OrganSignal[];
  afterSignals: OrganSignal[];
  horizonDays: number;
  /** From the patient profile (§12.3); drives body shape and organ set. */
  sex?: Sex;
  horizons?: number[];
  onHorizonChange?: (days: number) => void;
  analysisMeta?: {
    analyzedAt?: string;
    modelId?: string;
    ruleSetVersion?: string;
    sourceRecordCount?: number;
    stale?: boolean;
  };
}) {
  const { t } = useI18n();
  const reducedMotion = usePrefersReducedMotion();
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [prefer2d, setPrefer2d] = useState(false);
  const zoomApi = useRef<ZoomApi | null>(null);
  const [zoom, setZoom] = useState(1);
  const [model, setModel] = useState<Sex>(sex);
  const [mix, setMix] = useState(1);
  const [view, setView] = useState<TwinView>("front");
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const animation = useRef<number | null>(null);
  const projection = useRef<Projection>({});

  // Follow the record when it arrives or the patient changes.
  useEffect(() => {
    setModel(sex);
  }, [sex]);

  useEffect(() => {
    // Phones get the 2D diagram by default (§8.7): it is faster, and the twin
    // is easier to read at that width. The toggle below opts back into 3D.
    setWebglSupported(detectWebGL());
    setPrefer2d(window.innerWidth < 640);
  }, []);

  // Before/After buttons animate the morph; the slider drives it directly.
  const animateTo = useCallback(
    (target: number) => {
      if (animation.current) cancelAnimationFrame(animation.current);
      if (reducedMotion) {
        setMix(target);
        return;
      }
      const step = () => {
        setMix((current) => {
          const next = current + (target - current) * 0.16;
          if (Math.abs(target - next) < 0.005) return target;
          animation.current = requestAnimationFrame(step);
          return next;
        });
      };
      animation.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  useEffect(() => () => {
    if (animation.current) cancelAnimationFrame(animation.current);
  }, []);

  const selectHorizon = useCallback(
    (days: number) => {
      // Day 0 is the verified baseline, so it morphs the body back rather than
      // asking the server for another projection.
      if (days === 0) {
        animateTo(0);
        return;
      }
      if (days !== horizonDays) onHorizonChange?.(days);
      animateTo(1);
    },
    [animateTo, horizonDays, onHorizonChange],
  );

  const activeSignals = mix > 0.5 ? afterSignals : beforeSignals;
  const hasBaseline = beforeSignals.length > 0;

  const delta = useMemo(() => {
    const before = overallOf(beforeSignals);
    const after = overallOf(afterSignals);
    const rank: Record<RiskColor, number> = { green: 0, yellow: 1, red: 2 };
    if (!hasBaseline) return null;
    if (rank[after] < rank[before]) return "improves";
    if (rank[after] > rank[before]) return "deteriorates";
    return "unchanged";
  }, [beforeSignals, afterSignals, hasBaseline]);

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="readout">{t("twin.state")}</span>
          <div className="flex overflow-hidden rounded border" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={() => animateTo(0)}
              disabled={!hasBaseline}
              aria-pressed={mix <= 0.5}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition disabled:opacity-40 ${
                mix <= 0.5 ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
              }`}
            >
              {t("twin.before")}
            </button>
            <button
              onClick={() => animateTo(1)}
              aria-pressed={mix > 0.5}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                mix > 0.5 ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
              }`}
            >
              {t("twin.after")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="readout">{t("twin.model")}</span>
          <div
            className="flex overflow-hidden rounded border"
            style={{ borderColor: "var(--line)" }}
          >
            {(["male", "female"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setModel(option)}
                aria-pressed={model === option}
                className={`px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                  model === option ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t(option === "male" ? "twin.male" : "twin.female")}
              </button>
            ))}
          </div>
          {model !== sex && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-state-amber">
              {t("twin.notRecordedSex")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!prefer2d && webglSupported && <span className="readout">{t("twin.view")}</span>}
          {!prefer2d && webglSupported && VIEWS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-pressed={view === item.id}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                view === item.id
                  ? "border-signal/50 bg-signal/10 text-signal"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
              style={view === item.id ? undefined : { borderColor: "var(--line)" }}
            >
              {t(item.label)}
            </button>
          ))}
          {webglSupported && (
            <button
              onClick={() => setPrefer2d((value) => !value)}
              aria-pressed={prefer2d}
              className="rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink"
              style={{ borderColor: "var(--line)" }}
            >
              {prefer2d ? "3D" : "2D"}
            </button>
          )}
          {!prefer2d && webglSupported && (
          <button
            onClick={() => setAutoRotate((value) => !value)}
            aria-pressed={autoRotate}
            className="rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink"
            style={{ borderColor: "var(--line)" }}
          >
            {autoRotate ? t("twin.pauseSpin") : t("twin.autoSpin")}
          </button>
          )}
        </div>
      </div>

      {/* Stage and organ readout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div
        className="relative overflow-hidden rounded-lg border bg-[color:var(--console)]"
        style={{ borderColor: "var(--line)" }}
      >
        {webglSupported && !prefer2d && (
          <div className="absolute right-4 top-4 z-10">
            <ZoomControls api={zoomApi} zoom={zoom} onNavy onReset={() => setView("front")} />
          </div>
        )}
        <div className="h-[520px] w-full sm:h-[640px] lg:h-[720px]">
          {webglSupported === null ? (
            <div className="h-full w-full animate-pulse bg-ink/[0.035]" />
          ) : webglSupported && !prefer2d ? (
            <BodyScene
              beforeSignals={beforeSignals}
              afterSignals={afterSignals}
              mix={mix}
              view={view}
              sex={model}
              projection={projection}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              selectedOrgan={selectedOrgan}
              onSelectOrgan={setSelectedOrgan}
              zoomApi={zoomApi}
              onZoomChange={setZoom}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <BodyDiagram
                signals={activeSignals}
                selectedOrgan={selectedOrgan}
                onSelectOrgan={setSelectedOrgan}
              />
            </div>
          )}
        </div>

        {webglSupported && !prefer2d && (
          <OrganLabels
            signals={activeSignals}
            projection={projection}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
          />
        )}

        {horizons && horizons.length > 0 && (
          <HorizonTimeline
            horizons={horizons}
            activeDays={horizonDays}
            mix={mix}
            onSelect={selectHorizon}
          />
        )}

        {/* Corner readout */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
          <span className="readout !text-white/55">{t("twin.title")}</span>
          <span className="font-mono text-[11px] tabular-nums text-[#5fd4e6]">
            {t("twin.horizonReadout", {
              state: (mix > 0.5 ? t("twin.after") : t("twin.before")).toUpperCase(),
              days: horizonDays,
            })}
          </span>
          {(webglSupported === false || prefer2d) && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {webglSupported === false ? t("twin.diagram2dNoWebgl") : t("twin.diagram2d")}
            </span>
          )}
          </div>
          <span className="hidden sm:inline-flex">
            <ProvenanceChip grade="projection" />
          </span>
        </div>

      </div>

      {/* Organ readout rail */}
      <aside
        className="flex max-h-[720px] flex-col self-start overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--line)" }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2.5"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="readout">{t("twin.organReadout")}</span>
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {activeSignals.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <OrganMap
            signals={activeSignals}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
          />
        </div>
      </aside>
      </div>

      {/* Morph slider */}
      {hasBaseline && (
        <div className="flex items-center gap-4">
          <span className="readout shrink-0">{t("twin.before")}</span>
          <input
            type="range"
            className="morph w-full"
            min={0}
            max={100}
            value={Math.round(mix * 100)}
            onChange={(event) => setMix(Number(event.target.value) / 100)}
            aria-label={t("twin.blendLabel")}
            aria-valuetext={t("twin.blendValueText", { percent: Math.round(mix * 100) })}
          />
          <span className="readout shrink-0">{t("twin.after")}</span>
          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-signal">
            {Math.round(mix * 100)}%
          </span>
        </div>
      )}

      {/* Direction of change */}
      {delta && (
        <div className="panel flex items-center gap-3 p-3">
          <span className="readout">{t("twin.projectedChange")}</span>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{
              color:
                delta === "improves"
                  ? "var(--state-green)"
                  : delta === "deteriorates"
                    ? "var(--state-red)"
                    : "var(--ink-muted)",
            }}
          >
            {delta === "improves"
              ? t("twin.improves")
              : delta === "deteriorates"
                ? t("twin.deteriorates")
                : t("twin.unchanged")}
          </span>
        </div>
      )}

      <div className="rail" />

      {/* Legend: measured vs inferred vs projected */}
      <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <span className="readout">{t("twin.legend")}</span>
        {(["green", "yellow", "red"] as RiskColor[]).map((color) => (
          <span key={color} className="flex items-center gap-2 text-xs text-ink-muted">
            <span
              aria-hidden
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: STATE_HEX[color] }}
            >
              {STATE_GLYPH[color]}
            </span>
            {t(STATE_LABEL_KEY[color])}
          </span>
        ))}
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <span aria-hidden className="inline-block h-4 w-4 rounded-full bg-[#224a63]" />
          {t("twin.notAssessedLegend")}
        </span>
      </div>

      {/* Analysis metadata — required on every clinical analysis (§5). */}
      {analysisMeta && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4"
          style={{ borderColor: "var(--line)" }}
        >
          {analysisMeta.stale && (
            <span className="pulse-amber rounded border border-state-amber/40 bg-state-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-state-amber">
              {t("twin.stale")}
            </span>
          )}
          {analysisMeta.analyzedAt && (
            <Meta label={t("twin.analyzed")} value={formatDateTime(analysisMeta.analyzedAt)} />
          )}
          {analysisMeta.modelId && <Meta label={t("twin.modelId")} value={analysisMeta.modelId} />}
          {analysisMeta.ruleSetVersion && (
            <Meta label={t("twin.ruleSet")} value={analysisMeta.ruleSetVersion} />
          )}
          {typeof analysisMeta.sourceRecordCount === "number" && (
            <Meta label={t("twin.sourceRecords")} value={String(analysisMeta.sourceRecordCount)} />
          )}
        </div>
      )}

      <p className="max-w-readable text-xs leading-relaxed text-ink-faint">
        {t("twin.measuredNote")}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="readout">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-ink-muted">{value}</span>
    </span>
  );
}
