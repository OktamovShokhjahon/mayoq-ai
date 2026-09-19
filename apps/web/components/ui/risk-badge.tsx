"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

const CONFIG = {
  green: {
    glyph: "✓",
    classes: "border-state-green/40 bg-state-green/10 text-state-green",
    pulse: "",
  },
  yellow: {
    glyph: "△",
    classes: "border-state-amber/40 bg-state-amber/10 text-state-amber",
    pulse: "pulse-amber",
  },
  red: {
    glyph: "✕",
    classes: "border-state-red/40 bg-state-red/10 text-state-red",
    pulse: "pulse-red",
  },
} as const;

export function RiskBadge({
  color,
  label,
  quiet,
}: {
  color: "green" | "yellow" | "red";
  label?: string;
  /** Suppress the pulse where many badges appear at once (lists, tables). */
  quiet?: boolean;
}) {
  const { t } = useI18n();
  const config = CONFIG[color];
  // The risk wording is the badge's whole meaning, so it is translated even
  // when a caller passes its own visible label — the accessible name still has
  // to say which of the three levels this is.
  const riskLabel = t(`risk.${color}` as MessageKey);

  return (
    <span
      role="status"
      aria-label={`${riskLabel}${label ? `: ${label}` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${config.classes} ${quiet ? "" : config.pulse}`}
    >
      <span aria-hidden>{config.glyph}</span>
      {label ?? riskLabel}
    </span>
  );
}
