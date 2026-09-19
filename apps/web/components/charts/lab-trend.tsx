"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fieldLabel, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export interface LabRecord {
  _id: string;
  type: string;
  eventDate: string;
  data: { field?: string; value?: number | string; unit?: string };
}

/**
 * A patient's own measured values over time. Measurements only — nothing on
 * this chart is projected, because a patient reading their own record should
 * never have to work out which points actually happened.
 */
export function LabTrend({ records }: { records: LabRecord[] }) {
  const { t } = useI18n();
  const series = useMemo(() => {
    const byField = new Map<string, Array<{ date: string; value: number; unit?: string }>>();
    for (const record of records) {
      if (record.type !== "lab_result" && record.type !== "vital_sign") continue;
      const field = record.data.field;
      const value = typeof record.data.value === "number" ? record.data.value : Number(record.data.value);
      if (!field || !Number.isFinite(value)) continue;
      byField.set(field, [
        ...(byField.get(field) ?? []),
        { date: record.eventDate, value, unit: record.data.unit },
      ]);
    }
    return [...byField.entries()]
      .map(([field, points]) => ({
        field,
        unit: points[0]?.unit,
        points: points
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((point) => ({ label: formatDate(point.date), value: point.value })),
      }))
      .sort((a, b) => b.points.length - a.points.length);
  }, [records]);

  const [active, setActive] = useState(0);
  const selected = series[Math.min(active, series.length - 1)];

  if (series.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {t("chart.noMeasured")}
      </p>
    );
  }

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label={t("chart.chooseMeasurement")}>
          {series.map((entry, index) => (
            <button
              key={entry.field}
              onClick={() => setActive(index)}
              aria-pressed={index === active}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                index === active
                  ? "border-[color:var(--signal)] text-signal"
                  : "border-[color:var(--line)] text-ink-faint hover:text-ink"
              }`}
            >
              {fieldLabel(entry.field)}
            </button>
          ))}
        </div>
      )}

      {selected.points.length < 2 ? (
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[28px] tabular-nums text-ink">{selected.points[0].value}</span>
          <span className="text-[13px] text-ink-muted">
            {selected.unit} ·{" "}
            {t("chart.onDate", {
              field: fieldLabel(selected.field),
              date: selected.points[0].label,
            })}
          </span>
          <span className="text-[12px] text-ink-faint">
            {t("chart.oneMeasurement")}
          </span>
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selected.points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value}${selected.unit ? ` ${selected.unit}` : ""}`, fieldLabel(selected.field)]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--signal)"
                strokeWidth={1.75}
                dot={{ r: 3, fill: "var(--signal)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
        {t("chart.measuredOnly")}
      </p>
    </div>
  );
}
