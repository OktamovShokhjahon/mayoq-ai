import type { RiskColor } from "@/components/digital-twin/types";

/**
 * Synthetic demo cases for the public pages. They mirror the three patients the
 * API seed creates (`npm run seed`), so what a visitor sees here is what they
 * find after signing in to the demo clinic. Numbers are invented. Prose about
 * each case lives in `marketing-content.ts`, where it is translated.
 */
export type DemoCaseId = "alpha" | "beta" | "gamma";

export interface DemoCase {
  id: DemoCaseId;
  code: string;
  medications: string[];
  /** Serial readings, oldest first. */
  series: Array<{ label: string; value: number }>;
  /** Reference line for the chart, when the measure has a target. */
  target: { value: number; label: string };
  /** Which direction is better, so the chart can say so without colour. */
  betterWhen: "lower" | "higher";
  organs: Array<{ organ: string; color: RiskColor }>;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "alpha",
    code: "PT-DEMO-A1",
    medications: ["Metformin 500 mg × 2"],
    series: [
      { label: "Jan", value: 8.6 },
      { label: "Mar", value: 8.1 },
      { label: "May", value: 7.7 },
      { label: "Jul", value: 7.4 },
      { label: "Sep", value: 7.1 },
    ],
    target: { value: 7.0, label: "7.0" },
    betterWhen: "lower",
    organs: [
      { organ: "pancreas", color: "yellow" },
      { organ: "kidney", color: "yellow" },
      { organ: "heart", color: "green" },
      { organ: "eyes", color: "green" },
    ],
  },
  {
    id: "beta",
    code: "PT-DEMO-B2",
    medications: ["Amlodipine 5 mg", "Lisinopril 10 mg"],
    series: [
      { label: "Jan", value: 158 },
      { label: "Mar", value: 154 },
      { label: "May", value: 149 },
      { label: "Jul", value: 146 },
      { label: "Sep", value: 141 },
    ],
    target: { value: 130, label: "130" },
    betterWhen: "lower",
    organs: [
      { organ: "heart", color: "yellow" },
      { organ: "blood_vessels", color: "yellow" },
      { organ: "kidney", color: "green" },
      { organ: "eyes", color: "green" },
    ],
  },
  {
    id: "gamma",
    code: "PT-DEMO-C3",
    medications: ["Metformin 1000 mg", "Enalapril 10 mg", "Ibuprofen 400 mg"],
    series: [
      { label: "Jan", value: 74 },
      { label: "Mar", value: 68 },
      { label: "May", value: 61 },
      { label: "Sep", value: 55 },
    ],
    target: { value: 60, label: "60" },
    betterWhen: "higher",
    organs: [
      { organ: "kidney", color: "red" },
      { organ: "pancreas", color: "yellow" },
      { organ: "heart", color: "yellow" },
      { organ: "blood_vessels", color: "yellow" },
    ],
  },
];
