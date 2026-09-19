"use client";

import { ORGANS, STATE_GLYPH, STATE_HEX, STATE_LABEL_KEY, organLabelKey } from "./anatomy";
import { useI18n } from "@/lib/i18n";
import type { OrganSignal } from "./types";

/**
 * 2D body diagram. Used on mobile and where WebGL is unavailable (technical
 * mission §8.7), and rendered as the accessible description of the 3D scene.
 */
export function BodyDiagram({
  signals,
  selectedOrgan,
  onSelectOrgan,
}: {
  signals: OrganSignal[];
  selectedOrgan: string | null;
  onSelectOrgan: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const byKey = new Map(signals.map((signal) => [signal.organ, signal]));

  return (
    <svg
      viewBox="0 0 200 420"
      role="img"
      aria-label={t("twin.bodyDiagram")}
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="twin-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#dbe5ef" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Silhouette */}
      <g fill="url(#twin-body)" stroke="rgba(20,44,68,0.22)" strokeWidth="1">
        <ellipse cx="100" cy="36" rx="22" ry="26" />
        <rect x="93" y="60" width="14" height="12" rx="5" />
        <path d="M74 76 q26 -8 52 0 l8 44 q-6 30 -4 62 q-30 10 -60 0 q2 -32 -4 -62 z" />
        <path d="M70 78 l-14 8 l-10 66 l9 3 l12 -58 z" />
        <path d="M130 78 l14 8 l10 66 l-9 3 l-12 -58 z" />
        <path d="M80 182 l-4 100 l4 88 l16 0 l2 -86 l4 -102 z" />
        <path d="M120 182 l4 100 l-4 88 l-16 0 l-2 -86 l-4 -102 z" />
      </g>

      {/* Great vessels */}
      <path
        d="M100 100 L100 178 M100 116 L88 92 M100 116 L112 92 M100 178 L86 200 M100 178 L114 200"
        stroke="rgba(20,44,68,0.18)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Organ markers */}
      {ORGANS.map((organ) => {
        const signal = byKey.get(organ.key);
        const color = signal ? STATE_HEX[signal.color] : "#93a7b8";
        const [x, y] = organ.diagramAt;
        const active = selectedOrgan === organ.key;
        return (
          <g
            key={organ.key}
            onClick={() => onSelectOrgan(active ? null : organ.key)}
            className="cursor-pointer"
            tabIndex={0}
            role="button"
            aria-label={`${t(organLabelKey(organ.key))}: ${
              signal ? t(STATE_LABEL_KEY[signal.color]) : t("twin.notAssessed")
            }`}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectOrgan(active ? null : organ.key);
              }
            }}
          >
            <circle cx={x} cy={y} r={active ? 15 : 12} fill={color} opacity={signal ? 0.18 : 0.08} />
            <circle
              cx={x}
              cy={y}
              r={active ? 8 : 6.5}
              fill={color}
              opacity={signal ? 0.95 : 0.4}
              stroke={active ? "#13202c" : "transparent"}
              strokeWidth="1.5"
            />
            {signal && (
              <text
                x={x}
                y={y + 3.2}
                textAnchor="middle"
                fontSize="8"
                fill="#ffffff"
                fontWeight="700"
              >
                {STATE_GLYPH[signal.color]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
