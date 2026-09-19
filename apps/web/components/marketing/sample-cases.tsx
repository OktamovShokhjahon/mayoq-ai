"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pill, TriangleAlert } from "lucide-react";
import { STATE_GLYPH, STATE_HEX, STATE_LABEL_KEY, organLabelKey } from "@/components/digital-twin/anatomy";
import { DEMO_CASES } from "@/lib/demo-data";
import { useI18n } from "@/lib/i18n";
import { MARKETING_COPY } from "@/lib/marketing-content";

/** Frames the readings and the target line with a little air, instead of starting at zero. */
function yDomain(values: number[], target: number): [number, number] {
  const low = Math.min(...values, target);
  const high = Math.max(...values, target);
  const pad = Math.max((high - low) * 0.25, 0.3);
  return [Math.floor((low - pad) * 10) / 10, Math.ceil((high + pad) * 10) / 10];
}

/**
 * Sample cases. Three synthetic patients on tabs, each showing the reading that
 * moved, the organs it touched and, in words, what set the signal. This is the
 * fastest way to show the product's claim: numbers in, organ signals out, with
 * the reasoning attached.
 */
export function SampleCases() {
  const { t, locale } = useI18n();
  const copy = MARKETING_COPY[locale].cases;
  const [activeId, setActiveId] = useState(DEMO_CASES[0].id);
  const active = DEMO_CASES.find((item) => item.id === activeId) ?? DEMO_CASES[0];
  const text = copy.patients[active.id];

  return (
    <div className="panel overflow-hidden">
      <div role="tablist" aria-label={copy.eyebrow} className="flex overflow-x-auto border-b border-[color:var(--line)]">
        {DEMO_CASES.map((item) => {
          const selected = item.id === active.id;
          return (
            <button
              key={item.id}
              role="tab"
              id={`case-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="case-panel"
              onClick={() => setActiveId(item.id)}
              className={`whitespace-nowrap border-b-2 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                selected
                  ? "border-signal text-ink"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
            >
              {copy.patients[item.id].tab}
            </button>
          );
        })}
      </div>

      <div
        id="case-panel"
        role="tabpanel"
        aria-labelledby={`case-tab-${active.id}`}
        className="grid gap-8 p-6 lg:grid-cols-[1.15fr_1fr]"
      >
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="readout">{active.code}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
              {copy.synthetic}
            </span>
          </div>
          <p className="mt-2 text-[15px] text-ink">{text.summary}</p>

          <div className="mt-6">
            <span className="readout">
              {copy.trend} · {text.trendLabel}
            </span>
            <div className="mt-3 h-[220px] w-full" role="img" aria-label={`${copy.trend}: ${text.trendLabel}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={active.series} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  />
                  <YAxis
                    domain={yDomain(active.series.map((p) => p.value), active.target.value)}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                    tickFormatter={(value: number) => String(Math.round(value * 10) / 10)}
                  />
                  <ReferenceLine
                    y={active.target.value}
                    stroke="var(--state-amber)"
                    strokeDasharray="4 4"
                    label={{
                      value: `${copy.target} ${active.target.label}`,
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "var(--state-amber)",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                    cursor={{ stroke: "var(--line-strong)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--signal)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--signal)", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="readout mr-1 inline-flex items-center gap-1.5">
              <Pill className="h-3.5 w-3.5" aria-hidden /> {copy.meds}
            </span>
            {active.medications.map((med) => (
              <span
                key={med}
                className="rounded border px-2 py-0.5 font-mono text-[11px] text-ink-muted"
                style={{ borderColor: "var(--line)" }}
              >
                {med}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <span className="readout">{copy.organs}</span>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {active.organs.map(({ organ, color }) => (
                <li
                  key={organ}
                  className="flex items-center gap-2 rounded border px-3 py-2"
                  style={{ borderColor: `${STATE_HEX[color]}66` }}
                >
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: STATE_HEX[color] }}
                  >
                    {STATE_GLYPH[color]}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[13px] text-ink">{t(organLabelKey(organ))}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                      {t(STATE_LABEL_KEY[color])}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="readout">{copy.drivers}</span>
            <ul className="mt-3 flex flex-col gap-3">
              {text.drivers.map((line) => (
                <li key={line} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                  <TriangleAlert className="mt-[3px] h-3.5 w-3.5 shrink-0 text-signal" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
