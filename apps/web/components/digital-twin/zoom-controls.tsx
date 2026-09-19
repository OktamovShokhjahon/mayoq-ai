"use client";

import type { MutableRefObject } from "react";
import type { ZoomApi } from "./body-scene";
import { useI18n } from "@/lib/i18n";

/**
 * Zoom for the twin, plus the way back. The readout is not decoration: at 1× the whole body is in
 * frame, and past roughly 1.6× the body opens into separated organs — so the
 * number tells a doctor which of the two things they are looking at before
 * they reach for the wheel.
 */
export function ZoomControls({
  api,
  zoom,
  onNavy = false,
  onReset,
}: {
  api: MutableRefObject<ZoomApi | null>;
  zoom: number;
  onNavy?: boolean;
  /** Lets the page reset what it owns too, such as the chosen side. */
  onReset?: () => void;
}) {
  const { t } = useI18n();
  const atMin = zoom <= 1.01;
  const atMax = zoom >= 2.85;

  const base = onNavy
    ? "border-white/15 text-white/60 hover:border-white/35 hover:text-white"
    : "border-[color:var(--line)] text-ink-muted hover:border-[color:var(--line-strong)] hover:text-ink";

  return (
    <div
      className="flex items-center gap-1 rounded-md border p-1 backdrop-blur"
      style={{
        borderColor: onNavy ? "rgba(255,255,255,0.14)" : "var(--line)",
        background: onNavy ? "rgba(7,13,22,0.72)" : "rgb(var(--rgb-surface) / 0.82)",
      }}
    >
      <button
        type="button"
        onClick={() => api.current?.zoomBy(1 / 1.35)}
        disabled={atMin}
        aria-label={t("twin.zoomOut")}
        title={t("twin.zoomOut")}
        className={`flex h-7 w-7 items-center justify-center rounded border transition disabled:opacity-35 ${base}`}
      >
        <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5">
          <path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <span
        className="min-w-[46px] text-center font-mono text-[11px] tabular-nums"
        style={{ color: onNavy ? "rgba(255,255,255,0.75)" : "var(--ink-muted)" }}
      >
        {zoom.toFixed(1)}×
      </span>

      <button
        type="button"
        onClick={() => api.current?.zoomBy(1.35)}
        disabled={atMax}
        aria-label={t("twin.zoomIn")}
        title={t("twin.zoomIn")}
        className={`flex h-7 w-7 items-center justify-center rounded border transition disabled:opacity-35 ${base}`}
      >
        <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5">
          <path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {/* Always present, not only once zoomed: a viewer who has turned or
          zoomed the body needs one obvious way back, and a control that
          appears only after they are lost is not one. */}
      <button
        type="button"
        onClick={() => {
          api.current?.reset();
          onReset?.();
        }}
        aria-label={t("twin.defaultView")}
        title={t("twin.defaultView")}
        className={`ml-0.5 flex h-7 items-center gap-1.5 rounded border px-2 font-mono text-[10px] uppercase tracking-[0.12em] transition ${base}`}
      >
        <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5">
          <path
            d="M2.6 7a4.4 4.4 0 1 1 1.3 3.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M2.2 4.2v2.9h2.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">{t("twin.defaultView")}</span>
      </button>
    </div>
  );
}
