import { describe, expect, it } from "vitest";
import { buildPreventionPlan, bodyMassIndex, type PreventionSnapshot } from "./prevention-engine";
import { PREVENTION_CATALOG } from "./prevention-catalog";

const empty: PreventionSnapshot = {
  diagnosisLabels: [],
  labValues: {},
};

describe("prevention catalog boundary", () => {
  /**
   * The load-bearing guarantee of this module. Prevention guidance reaches a
   * patient without passing through a doctor's approval, so it must never be
   * able to say anything about medication — that path stays exclusively with
   * an approved treatment scenario.
   */
  it("never mentions starting, stopping or changing a medication", () => {
    const forbidden =
      /\b(dose|dosage|mg\b|take .*tablet|start taking|stop taking|increase your|decrease your|double the|halve the|prescrib)/i;

    for (const program of PREVENTION_CATALOG) {
      const text = [
        program.title,
        program.because,
        program.prevents,
        program.expected.statement,
        ...program.routine.flatMap((step) => [step.action, step.detail]),
      ].join(" ");
      expect(text, `program ${program.code} must not touch medication`).not.toMatch(forbidden);
    }
  });

  it("gives every program a routine and a checkable expected result", () => {
    for (const program of PREVENTION_CATALOG) {
      expect(program.routine.length, program.code).toBeGreaterThan(0);
      expect(program.expected.measure.length, program.code).toBeGreaterThan(0);
      expect(program.expected.horizonDays, program.code).toBeGreaterThan(0);
    }
  });

  it("uses unique codes", () => {
    const codes = PREVENTION_CATALOG.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("buildPreventionPlan", () => {
  it("stays silent on an empty record rather than guessing", () => {
    const plan = buildPreventionPlan(empty);
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.missingData).toHaveLength(0);
  });

  it("asks for the kidney test once a chronic diagnosis is on file", () => {
    const plan = buildPreventionPlan({
      diagnosisLabels: ["Essential hypertension"],
      labValues: {},
    });
    expect(plan.suggestions.map((s) => s.code)).toContain("RENAL_MONITORING_GAP");
    expect(plan.missingData).toContain("latestEgfr");
  });

  it("fires the blood-pressure program only above the threshold", () => {
    const below = buildPreventionPlan({
      diagnosisLabels: ["Essential hypertension"],
      labValues: { latestSystolicBp: 128 },
    });
    expect(below.suggestions.map((s) => s.code)).not.toContain("HTN_SODIUM_AND_WALKING");

    const above = buildPreventionPlan({
      diagnosisLabels: ["Essential hypertension"],
      labValues: { latestSystolicBp: 152 },
    });
    const hit = above.suggestions.find((s) => s.code === "HTN_SODIUM_AND_WALKING");
    expect(hit).toBeDefined();
    expect(hit!.because).toContain("152");
    expect(hit!.observed?.value).toBe(152);
  });

  it("quotes the measured HbA1c back in the reason", () => {
    const plan = buildPreventionPlan({
      diagnosisLabels: ["Type 2 diabetes mellitus"],
      labValues: { latestHba1c: 8.4 },
    });
    const hit = plan.suggestions.find((s) => s.code === "T2DM_GLYCAEMIC_ROUTINE");
    expect(hit).toBeDefined();
    expect(hit!.because).toContain("8.4");
  });

  it("does not offer diabetes programs to a patient without the diagnosis", () => {
    const plan = buildPreventionPlan({
      diagnosisLabels: ["Essential hypertension"],
      labValues: { latestHba1c: 9.1 },
    });
    expect(plan.suggestions.map((s) => s.code)).not.toContain("T2DM_GLYCAEMIC_ROUTINE");
    expect(plan.suggestions.map((s) => s.code)).not.toContain("RETINAL_SCREENING_GAP");
  });

  it("fires cessation only for a current smoker", () => {
    for (const status of ["never", "former", "unknown"] as const) {
      const plan = buildPreventionPlan({ ...empty, smokingStatus: status });
      expect(plan.suggestions.map((s) => s.code)).not.toContain("SMOKING_CESSATION");
    }
    const smoker = buildPreventionPlan({ ...empty, smokingStatus: "current" });
    expect(smoker.suggestions.map((s) => s.code)).toContain("SMOKING_CESSATION");
  });

  it("ranks the largest available change first", () => {
    const plan = buildPreventionPlan({
      diagnosisLabels: ["Type 2 diabetes mellitus", "Essential hypertension"],
      labValues: { latestSystolicBp: 150, latestHba1c: 8.2, latestEgfr: 82 },
      smokingStatus: "current",
    });
    expect(plan.suggestions[0].code).toBe("SMOKING_CESSATION");
    expect(plan.suggestions[1].code).toBe("HTN_SODIUM_AND_WALKING");
  });

  it("drops the renal-gap suggestion once the value is on file", () => {
    const withValue = buildPreventionPlan({
      diagnosisLabels: ["Essential hypertension"],
      labValues: { latestEgfr: 74 },
    });
    expect(withValue.suggestions.map((s) => s.code)).not.toContain("RENAL_MONITORING_GAP");
    expect(withValue.missingData).not.toContain("latest eGFR");
  });

  it("is deterministic for the same snapshot", () => {
    const snapshot: PreventionSnapshot = {
      diagnosisLabels: ["Type 2 diabetes mellitus"],
      labValues: { latestHba1c: 8.0 },
      smokingStatus: "current",
    };
    const a = buildPreventionPlan(snapshot);
    const b = buildPreventionPlan(snapshot);
    expect(a.suggestions).toEqual(b.suggestions);
  });
});

describe("bodyMassIndex", () => {
  it("computes BMI to one decimal", () => {
    expect(bodyMassIndex(180, 97.2)).toBe(30);
  });

  it("is undefined when a measurement is missing", () => {
    expect(bodyMassIndex(undefined, 90)).toBeUndefined();
    expect(bodyMassIndex(170, undefined)).toBeUndefined();
    expect(bodyMassIndex(0, 90)).toBeUndefined();
  });

  it("fires the weight program only at or above BMI 30", () => {
    const withDiagnosis = { diagnosisLabels: ["Type 2 diabetes mellitus"], labValues: {} };
    const under = buildPreventionPlan({ ...withDiagnosis, heightCm: 180, weightKg: 85 });
    expect(under.suggestions.map((s) => s.code)).not.toContain("WEIGHT_REDUCTION");

    const over = buildPreventionPlan({ ...withDiagnosis, heightCm: 180, weightKg: 100 });
    const hit = over.suggestions.find((s) => s.code === "WEIGHT_REDUCTION");
    expect(hit).toBeDefined();
    expect(hit!.because).toContain("30.9");
  });
});
