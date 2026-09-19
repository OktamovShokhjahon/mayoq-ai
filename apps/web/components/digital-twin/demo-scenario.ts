import type { OrganSignal } from "./types";
import type { MessageKey } from "@/lib/locales/uz";

/**
 * Synthetic demo patient (technical mission §23, patient 3): combined type 2
 * diabetes and hypertension, with a mixed green/yellow projection. Fictional —
 * it must never resemble an identifiable person. Also used as the explicit
 * fallback dataset when the AI service is unavailable (§9.5).
 */
export const DEMO_PATIENT = {
  code: "SYN-0031",
  summary: "Synthetic patient · type 2 diabetes + hypertension",
  horizonDays: 90,
};

export const DEMO_BEFORE: OrganSignal[] = [
  {
    organ: "kidney",
    severity: "moderate",
    color: "yellow",
    explanation: "demo.before.kidney",
    missingData: ["demo.missing.egfr", "demo.missing.creatinine"],
    evidence: "clinical_rule",
  },
  {
    organ: "heart",
    severity: "moderate",
    color: "yellow",
    explanation: "demo.before.heart",
    missingData: [],
    evidence: "verified",
  },
  {
    organ: "pancreas",
    severity: "high",
    color: "red",
    explanation: "demo.before.pancreas",
    missingData: [],
    evidence: "verified",
  },
  {
    organ: "blood_vessels",
    severity: "moderate",
    color: "yellow",
    explanation: "demo.before.blood_vessels",
    missingData: ["demo.missing.lipid"],
    evidence: "clinical_rule",
  },
  {
    organ: "eyes",
    severity: "low",
    color: "yellow",
    explanation: "demo.before.eyes",
    missingData: ["demo.missing.retinal"],
    evidence: "clinical_rule",
  },
];

export const DEMO_AFTER: OrganSignal[] = [
  {
    organ: "kidney",
    severity: "moderate",
    color: "yellow",
    explanation: "demo.after.kidney",
    missingData: ["demo.missing.egfr", "demo.missing.creatinine"],
    evidence: "clinical_rule",
  },
  {
    organ: "heart",
    severity: "low",
    color: "green",
    explanation: "demo.after.heart",
    missingData: [],
    evidence: "projection",
  },
  {
    organ: "pancreas",
    severity: "moderate",
    color: "yellow",
    explanation: "demo.after.pancreas",
    missingData: [],
    evidence: "projection",
  },
  {
    organ: "blood_vessels",
    severity: "low",
    color: "green",
    explanation: "demo.after.blood_vessels",
    missingData: ["demo.missing.lipid"],
    evidence: "projection",
  },
  {
    organ: "eyes",
    severity: "low",
    color: "yellow",
    explanation: "demo.after.eyes",
    missingData: ["demo.missing.retinal"],
    evidence: "clinical_rule",
  },
];

export const DEMO_META = {
  analyzedAt: "2026-09-18T09:14:00.000Z",
  modelId: "gemini-2.5-flash",
  ruleSetVersion: "rules-2026.03",
  sourceRecordCount: 14,
  stale: false,
};

/**
 * Checkpoints the landing twin can be scrubbed to. `mix` is the blend between
 * DEMO_BEFORE and DEMO_AFTER, so the organs recolour gradually rather than
 * snapping between two states. Days are a real sequence, which is why they are
 * numbered — the order is the information.
 *
 * Synthetic, like the rest of this scenario. The notes are written from the
 * projection above so the caption can never contradict the organ colours.
 */
export interface TimelineStop {
  day: number;
  label: string;
  mix: number;
  /** Message key; the hero resolves it, so the caption follows the language switch. */
  note: MessageKey;
}

export const DEMO_TIMELINE: TimelineStop[] = [
  {
    day: 0,
    label: "Today",
    mix: 0,
    note: "demo.note.0",
  },
  {
    day: 30,
    label: "Day 30",
    mix: 1 / 3,
    note: "demo.note.30",
  },
  {
    day: 60,
    label: "Day 60",
    mix: 2 / 3,
    note: "demo.note.60",
  },
  {
    day: 90,
    label: "Day 90",
    mix: 1,
    note: "demo.note.90",
  },
];
