import { describe, expect, it } from "vitest";
import { SPEC_BY_FIELD, analyseSeries, type SeriesPoint } from "./trend-engine";

const hba1c = SPEC_BY_FIELD.latestHba1c;
const egfr = SPEC_BY_FIELD.latestEgfr;

function series(values: number[], stepDays = 60): SeriesPoint[] {
  return values.map((value, i) => ({
    date: new Date(Date.UTC(2026, 0, 1) + i * stepDays * 86_400_000).toISOString(),
    value,
  }));
}

describe("analyseSeries", () => {
  it("returns nothing when there are no usable readings", () => {
    expect(analyseSeries(hba1c, [])).toBeUndefined();
    // 99 is not a plausible HbA1c: an entry error must not become a trend.
    expect(analyseSeries(hba1c, series([99]))).toBeUndefined();
  });

  it("draws no forecast from fewer than three readings", () => {
    const one = analyseSeries(hba1c, series([8.1]));
    const two = analyseSeries(hba1c, series([8.1, 7.8]));
    expect(one?.forecast).toBeUndefined();
    expect(two?.forecast).toBeUndefined();
    expect(two?.confidence).toBe("insufficient");
    expect(two?.caveat).toMatch(/two readings/i);
  });

  it("reads a falling HbA1c as improving and projects when it reaches target", () => {
    const result = analyseSeries(hba1c, series([8.6, 8.1, 7.7, 7.4, 7.1]))!;
    expect(result.direction).toBe("improving");
    expect(result.targetStatus).toBe("off_target");
    expect(result.slopePer30d).toBeLessThan(0);
    expect(result.daysToTarget).toBeGreaterThan(0);
    expect(result.forecast).toHaveLength(3);
    const [d30, d60, d90] = result.forecast!;
    expect(d90.expected).toBeLessThan(d30.expected);
    // The band widens the further out the forecast reaches.
    expect(d90.high - d90.low).toBeGreaterThan(d30.high - d30.low);
    expect(d60.low).toBeLessThanOrEqual(d60.expected);
    expect(d60.high).toBeGreaterThanOrEqual(d60.expected);
  });

  it("respects direction of good: a falling eGFR is worsening", () => {
    const result = analyseSeries(egfr, series([74, 68, 61, 55]))!;
    expect(result.direction).toBe("worsening");
    expect(result.targetStatus).toBe("off_target");
    // It is moving away from target, so there is no crossing to predict.
    expect(result.daysToTarget).toBeUndefined();
  });

  it("calls a flat run stable", () => {
    const result = analyseSeries(hba1c, series([7.2, 7.3, 7.2, 7.3, 7.2]))!;
    expect(result.direction).toBe("stable");
  });

  it("orders readings by date before fitting", () => {
    const shuffled = series([8.6, 8.1, 7.7, 7.4, 7.1]).reverse();
    const result = analyseSeries(hba1c, shuffled)!;
    expect(result.direction).toBe("improving");
    expect(result.latest.value).toBe(7.1);
  });

  it("warns when the history is short", () => {
    const result = analyseSeries(hba1c, series([8.0, 7.8, 7.6], 30))!;
    expect(result.confidence).toBe("limited");
    expect(result.caveat).toMatch(/reaches further/i);
  });

  it("leaves out horizons that reach too far past the data", () => {
    // 3 readings 20 days apart cover 40 days: 30 and 60 are within reach, 90 is not.
    const result = analyseSeries(hba1c, series([8.0, 7.8, 7.6], 20))!;
    expect(result.forecast?.map((f) => f.day)).toEqual([30, 60]);
    expect(result.caveat).toMatch(/too short/i);
  });

  it("draws no forecast when readings cover under four weeks", () => {
    const result = analyseSeries(hba1c, series([8.0, 7.8, 7.6], 7))!;
    expect(result.forecast).toBeUndefined();
    expect(result.caveat).toMatch(/only 14 days/i);
  });

  it("counts several entries on one day as a single reading", () => {
    const day = "2026-03-01T09:00:00.000Z";
    const dupes = [1, 2, 3, 4].map(() => ({ date: day, value: 7.4 }));
    const result = analyseSeries(hba1c, dupes)!;
    expect(result.points).toHaveLength(1);
    expect(result.forecast).toBeUndefined();
  });

  it("keeps the band inside what the measurement can be", () => {
    const result = analyseSeries(egfr, series([40, 30, 21, 12, 6]))!;
    for (const f of result.forecast ?? []) {
      expect(f.low).toBeGreaterThanOrEqual(3);
      expect(f.high).toBeLessThanOrEqual(160);
    }
  });

  it("is deterministic", () => {
    const input = series([8.6, 8.1, 7.7, 7.4, 7.1]);
    expect(analyseSeries(hba1c, input)).toEqual(analyseSeries(hba1c, input));
  });
});
