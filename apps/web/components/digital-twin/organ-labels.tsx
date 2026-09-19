"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ORGAN_BY_KEY, STATE_GLYPH, STATE_HEX_3D, STATE_LABEL_KEY, organLabelKey } from "./anatomy";
import { useI18n } from "@/lib/i18n";
import type { OrganSignal } from "./types";

/** Screen-space position of each organ, written by the scene every frame. */
export type Projection = Record<string, { x: number; y: number; visible: boolean }>;

/**
 * Leader-line labels, in the convention medical illustration uses: names sit in
 * calm columns down each side and a hairline runs to the organ itself. Labels
 * anchored in 3D swing with the body and collide with each other; these stay
 * put and only the line moves.
 *
 * Positions come from a ref the scene writes to, so tracking the model costs no
 * React renders — the loop below mutates the line and dot attributes directly.
 */
export function OrganLabels({
  signals,
  projection,
  selectedOrgan,
  onSelectOrgan,
}: {
  signals: OrganSignal[];
  projection: React.MutableRefObject<Projection>;
  selectedOrgan: string | null;
  onSelectOrgan: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const labelNodes = useRef<Record<string, HTMLButtonElement | null>>({});
  const lineNodes = useRef<Record<string, SVGPolylineElement | null>>({});
  const dotNodes = useRef<Record<string, SVGCircleElement | null>>({});
  const anchors = useRef<Record<string, { x: number; y: number }>>({});

  // Only labelled organs are laid out, and each side is ordered head-to-pelvis
  // so the leaders never cross.
  const sides = { left: [] as OrganSignal[], right: [] as OrganSignal[] };
  for (const signal of signals) {
    const organ = ORGAN_BY_KEY[signal.organ];
    if (!organ) continue;
    sides[organ.labelSide].push(signal);
  }
  for (const key of ["left", "right"] as const) {
    sides[key].sort((a, b) => {
      const ay = ORGAN_BY_KEY[a.organ]?.sites[0].position[1] ?? 0;
      const by = ORGAN_BY_KEY[b.organ]?.sites[0].position[1] ?? 0;
      return by - ay;
    });
  }

  /**
   * Places each label at the height of its own organ, resolves overlaps with a
   * single downward push, then records the inner edge as the leader's anchor.
   */
  const measure = useCallback(() => {
    const box = container.current?.getBoundingClientRect();
    if (!box) return;

    // Model space: feet near y=0, head near y=1.75.
    const toTop = (modelY: number) => (1 - (modelY - 0.05) / 1.72) * box.height;

    for (const side of ["left", "right"] as const) {
      const entries = Object.entries(labelNodes.current)
        .filter(([key, node]) => node && ORGAN_BY_KEY[key]?.labelSide === side)
        .map(([key, node]) => ({
          key,
          node: node as HTMLButtonElement,
          y: toTop(ORGAN_BY_KEY[key].sites[0].position[1]),
        }))
        .sort((a, b) => a.y - b.y);

      const gap = 26;
      let floor = 6;
      for (const entry of entries) {
        const top = Math.max(entry.y - gap / 2, floor);
        entry.node.style.top = `${top}px`;
        floor = top + gap;
      }
      // If the stack ran past the bottom, lift the whole column back inside.
      const overflow = floor - gap + 22 - box.height;
      if (overflow > 0) {
        for (const entry of entries) {
          entry.node.style.top = `${parseFloat(entry.node.style.top) - overflow}px`;
        }
      }
    }

    for (const [key, node] of Object.entries(labelNodes.current)) {
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const organ = ORGAN_BY_KEY[key];
      anchors.current[key] = {
        x: (organ?.labelSide === "left" ? rect.right : rect.left) - box.left,
        y: rect.top + rect.height / 2 - box.top,
      };
    }
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [measure, signals]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      for (const [key, anchor] of Object.entries(anchors.current)) {
        const target = projection.current[key];
        const line = lineNodes.current[key];
        const dot = dotNodes.current[key];
        if (!target || !line || !dot) continue;

        if (!target.visible) {
          line.setAttribute("opacity", "0");
          dot.setAttribute("opacity", "0");
          continue;
        }
        line.setAttribute("opacity", "1");
        dot.setAttribute("opacity", "1");

        // Elbow: out from the label, then in to the organ. Reads as a drawn
        // leader rather than a straight tether across the body.
        const side = ORGAN_BY_KEY[key]?.labelSide === "left" ? 1 : -1;
        const elbow = anchor.x + side * Math.max(12, Math.abs(target.x - anchor.x) * 0.25);
        line.setAttribute(
          "points",
          `${anchor.x},${anchor.y} ${elbow},${anchor.y} ${target.x},${target.y}`,
        );
        dot.setAttribute("cx", String(target.x));
        dot.setAttribute("cy", String(target.y));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [projection, signals]);

  return (
    <div ref={container} className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {signals.map((signal) => {
          const active = selectedOrgan === signal.organ;
          return (
            <g key={signal.organ}>
              <polyline
                ref={(node) => {
                  lineNodes.current[signal.organ] = node;
                }}
                fill="none"
                stroke={STATE_HEX_3D[signal.color]}
                strokeWidth={active ? 1.6 : 1}
                strokeOpacity={active ? 1 : 0.7}
              />
              <circle
                ref={(node) => {
                  dotNodes.current[signal.organ] = node;
                }}
                r={active ? 4 : 2.6}
                fill="none"
                stroke={STATE_HEX_3D[signal.color]}
                strokeWidth={1.2}
                strokeOpacity={active ? 1 : 0.7}
              />
            </g>
          );
        })}
      </svg>

      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          className={`absolute inset-y-0 ${side === "left" ? "left-3" : "right-3"}`}
        >
          {sides[side].map((signal) => {
            const organ = ORGAN_BY_KEY[signal.organ];
            const active = selectedOrgan === signal.organ;
            return (
              <button
                key={signal.organ}
                ref={(node) => {
                  labelNodes.current[signal.organ] = node;
                }}
                type="button"
                onClick={() => onSelectOrgan(active ? null : signal.organ)}
                aria-pressed={active}
                className={`pointer-events-auto absolute flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 backdrop-blur transition ${
                  side === "left" ? "left-0" : "right-0"
                } ${active ? "bg-[#0f1c24] shadow-sm" : "bg-[#0b141a]/85 hover:bg-[#0f1c24]"}`}
                style={{
                  borderColor: active ? STATE_HEX_3D[signal.color] : "rgba(220,234,242,0.24)",
                }}
              >
                <span
                  aria-hidden
                  className="font-mono text-[9px] font-bold leading-none"
                  style={{ color: STATE_HEX_3D[signal.color] }}
                >
                  {STATE_GLYPH[signal.color]}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#dce6ec]">
                  {organ ? t(organLabelKey(organ.key)) : signal.organ}
                </span>
                <span className="sr-only">: {t(STATE_LABEL_KEY[signal.color])}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
