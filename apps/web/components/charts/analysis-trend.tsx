"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export interface TrendPoint {
  /** `YYYY-MM-DD`, as grouped by the analytics endpoint. */
  _id: string;
  count: number;
  redCount: number;
}

/**
 * Analyses run per day, with the high-priority share drawn on top. Volume is
 * the clinic-level fact an admin is entitled to; the line is there to answer
 * "is this getting worse?" without exposing anything clinical.
 */
export function AnalysisTrend({ data }: { data: TrendPoint[] }) {
  const { t } = useI18n();

  if (data.length === 0) {
    return <p className="py-6 text-sm text-ink-faint">{t("chart.noAnalysesYet")}</p>;
  }

  const points = data.map((point) => ({
    date: point._id,
    label: formatDate(point._id),
    analyses: point.count,
    highPriority: point.redCount,
  }));

  const axis = {
    tick: { fontSize: 11, fill: "var(--ink-faint)" },
    tickLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--sunken)" }}
      contentStyle={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        fontSize: 12,
      }}
      labelStyle={{ color: "var(--ink-muted)" }}
    />
  );

  // One or two days of history is not a trend. A line through a single point
  // reads as "nothing happened", which is the opposite of the truth.
  if (points.length < 3) {
    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={4}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" {...axis} axisLine={{ stroke: "var(--line)" }} />
            <YAxis allowDecimals={false} {...axis} axisLine={false} width={36} />
            {tooltip}
            <Bar dataKey="analyses" name={t("chart.analyses")} fill="var(--signal)" radius={[3, 3, 0, 0]} maxBarSize={56} />
            <Bar dataKey="highPriority" name={t("chart.highPriority")} fill="var(--state-red)" radius={[3, 3, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="analysisVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--signal)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--ink-muted)" }}
          />
          <Area
            type="monotone"
            dataKey="analyses"
            name={t("chart.analyses")}
            stroke="var(--signal)"
            strokeWidth={1.5}
            fill="url(#analysisVolume)"
          />
          <Line
            type="monotone"
            dataKey="highPriority"
            name={t("chart.highPriority")}
            stroke="var(--state-red)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
