/**
 * Deterministic trend and prognosis engine.
 *
 * Everything on the prognosis chart comes from here, not from a model: a fitted
 * line through the patient's own verified readings, with a prediction band
 * derived from how far those readings scatter around it. A model may describe
 * this result; it cannot move it. Same input, same output.
 *
 * This is an extrapolation of past readings, not a physiological model. It
 * assumes the recent slope continues, which stops being true the day a
 * treatment changes, so every output here is labelled a projection.
 */

import { deepStrings, type DeepStrings } from "./deep-strings";

export interface TrendSpec {
  field: string;
  label: string;
  unit: string;
  /** Which direction is the healthy one. */
  better: "lower" | "higher";
  /** General reference target, shown as a line. Doctors individualise it. */
  target: number;
  /** Organs this measurement speaks for. */
  organs: string[];
  /** Readings outside this range are treated as entry errors and ignored. */
  plausible: [number, number];
}

export const TREND_SPECS: TrendSpec[] = [
  { field: "latestHba1c", label: "HbA1c", unit: "%", better: "lower", target: 7.0, organs: ["pancreas"], plausible: [3, 20] },
  { field: "latestEgfr", label: "eGFR", unit: "ml/min", better: "higher", target: 60, organs: ["kidney"], plausible: [3, 160] },
  { field: "latestCreatinine", label: "Creatinine", unit: "mg/dL", better: "lower", target: 1.2, organs: ["kidney"], plausible: [0.1, 15] },
  { field: "latestAlt", label: "ALT", unit: "U/L", better: "lower", target: 40, organs: ["liver"], plausible: [1, 2000] },
  { field: "latestAst", label: "AST", unit: "U/L", better: "lower", target: 40, organs: ["liver"], plausible: [1, 2000] },
  { field: "latestSystolicBp", label: "Systolic BP", unit: "mmHg", better: "lower", target: 140, organs: ["heart", "blood_vessels"], plausible: [60, 260] },
];

export const SPEC_BY_FIELD: Record<string, TrendSpec> = Object.fromEntries(TREND_SPECS.map((s) => [s.field, s]));

export interface SeriesPoint {
  /** ISO date of the measurement. */
  date: string;
  value: number;
  recordId?: string;
}

export type Direction = "improving" | "worsening" | "stable";
export type TargetStatus = "at_target" | "off_target";

export interface ForecastPoint {
  /** Days after the latest reading. */
  day: number;
  date: string;
  expected: number;
  low: number;
  high: number;
}

export interface TrendResult {
  field: string;
  label: string;
  unit: string;
  target: number;
  better: "lower" | "higher";
  organs: string[];
  points: SeriesPoint[];
  latest: SeriesPoint;
  targetStatus: TargetStatus;
  /** Change per 30 days along the fitted line. Absent with fewer than 3 readings. */
  slopePer30d?: number;
  direction?: Direction;
  /** Days from the latest reading until the line crosses the target; absent if it never does within a year. */
  daysToTarget?: number;
  /** Absent with fewer than 3 readings: two points make a line but not a forecast. */
  forecast?: ForecastPoint[];
  /** How much to lean on the forecast. */
  confidence: "insufficient" | "limited" | "moderate";
  /** Why the forecast is missing or weak, in words a doctor can act on. */
  caveat?: string;
}

export const FORECAST_DAYS = [30, 60, 90];
/** A forecast needs readings spread over at least this long, or the slope is noise. */
const MIN_SPAN_DAYS = 28;
/** How far past the last reading the line may be drawn, as a multiple of the span the data covers. */
const MAX_REACH = 2;
const DAY_MS = 86_400_000;

/** z for a ~90% two-sided band. Small samples are wider still via the t correction below. */
const T_90: Record<number, number> = { 1: 6.31, 2: 2.92, 3: 2.35, 4: 2.13, 5: 2.02, 6: 1.94, 7: 1.89, 8: 1.86 };
function tCritical(dof: number): number {
  if (dof <= 0) return 6.31;
  return T_90[dof] ?? 1.7;
}

function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/**
 * `strings` carries the language the report is being written in. The fit itself
 * is language-free; only the label and the caveats it attaches are not, and
 * those are read by the same person reading the rest of the page.
 */
export function analyseSeries(spec: TrendSpec, raw: SeriesPoint[], strings: DeepStrings = deepStrings()): TrendResult | undefined {
  const sorted = raw
    .filter((p) => Number.isFinite(p.value) && p.value >= spec.plausible[0] && p.value <= spec.plausible[1])
    .filter((p) => Number.isFinite(new Date(p.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // One reading per calendar day (the last entered). Duplicate entries for a
  // day, from a re-import or a repeat test, are one measurement, and counting
  // them separately would fake both a sample size and a tight fit.
  const byDay = new Map<string, SeriesPoint>();
  for (const p of sorted) byDay.set(new Date(p.date).toISOString().slice(0, 10), p);
  const points = [...byDay.values()];
  if (points.length === 0) return undefined;

  const latest = points[points.length - 1];
  const atTarget = spec.better === "lower" ? latest.value <= spec.target : latest.value >= spec.target;

  const base: TrendResult = {
    field: spec.field,
    label: strings.measure[spec.field] ?? spec.label,
    unit: spec.unit,
    target: spec.target,
    better: spec.better,
    organs: spec.organs,
    points,
    latest,
    targetStatus: atTarget ? "at_target" : "off_target",
    confidence: "insufficient",
    caveat: points.length === 1 ? strings.caveat.onePoint : strings.caveat.twoPoints,
  };
  if (points.length < 3) return base;

  // Ordinary least squares on days since the first reading.
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / DAY_MS);
  const ys = points.map((p) => p.value);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  if (sxx === 0) return { ...base, caveat: strings.caveat.sameDate };
  const span = xs[n - 1] - xs[0];
  if (span < MIN_SPAN_DAYS) {
    return {
      ...base,
      caveat: strings.caveat.shortSpan(Math.round(span), MIN_SPAN_DAYS),
    };
  }
  const sxy = xs.reduce((a, x, i) => a + (x - meanX) * (ys[i] - meanY), 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const dof = n - 2;
  const sse = residuals.reduce((a, r) => a + r * r, 0);
  // A perfectly straight run of readings has no scatter, but a forecast is
  // never certain: keep a floor of 2% of the level so the band never collapses.
  const s = Math.max(Math.sqrt(sse / Math.max(dof, 1)), Math.abs(meanY) * 0.02);
  const t = tCritical(dof);

  const lastX = xs[n - 1];
  const lastDate = new Date(latest.date).getTime();
  const [floor, ceiling] = spec.plausible;
  const clamp = (v: number) => Math.min(ceiling, Math.max(floor, v));
  const reachable = FORECAST_DAYS.filter((day) => day <= span * MAX_REACH);
  const forecast: ForecastPoint[] = reachable.map((day) => {
    const x = lastX + day;
    const expected = intercept + slope * x;
    // Prediction interval: widens the further we reach beyond the data.
    const se = s * Math.sqrt(1 + 1 / n + (x - meanX) ** 2 / sxx);
    const half = t * se;
    return {
      day,
      date: new Date(lastDate + day * DAY_MS).toISOString().slice(0, 10),
      // A band can not run outside what the measurement can physically be.
      expected: round(clamp(expected)),
      low: round(clamp(expected - half)),
      high: round(clamp(expected + half)),
    };
  });

  const slopePer30d = round(slope * 30, 3);
  // "Stable" means the drift over 90 days is smaller than the scatter.
  const drift90 = Math.abs(slope * 90);
  const direction: Direction =
    drift90 < s
      ? "stable"
      : (slope < 0) === (spec.better === "lower")
        ? "improving"
        : "worsening";

  let daysToTarget: number | undefined;
  if (!atTarget && slope !== 0) {
    const towards = spec.better === "lower" ? slope < 0 : slope > 0;
    if (towards) {
      const days = (spec.target - (intercept + slope * lastX)) / slope;
      if (days > 0 && days <= 365) daysToTarget = Math.round(days);
    }
  }

  const confidence: TrendResult["confidence"] = n >= 5 && span >= 90 ? "moderate" : "limited";
  const caveats: string[] = [];
  if (n < 5) caveats.push(strings.caveat.fewReadings(n));
  if (span < 60) caveats.push(strings.caveat.underTwoMonths);
  // A long forecast from a short history is the classic overreach.
  if (reachable.length < FORECAST_DAYS.length) caveats.push(strings.caveat.tooShortForNinety);
  else if (span < 90) caveats.push(strings.caveat.ninetyBeyondHistory);

  return {
    ...base,
    slopePer30d,
    direction,
    daysToTarget,
    forecast,
    confidence,
    caveat: caveats.length ? caveats.join(" ") : undefined,
  };
}
