import { describe, expect, it } from "vitest";
import { runClinicalRules, type PatientSnapshot } from "./rule-engine";
import { LAB_FIELDS, RULE_SET_VERSION } from "./rule-catalog";

function snapshot(overrides: Partial<PatientSnapshot> = {}): PatientSnapshot {
  return {
    diagnosisLabels: [],
    medicationNames: [],
    labValues: {},
    evidenceRecordIds: [],
    ...overrides,
  };
}

describe("clinical rule engine", () => {
  it("stamps every result with the catalog version that produced it", () => {
    expect(runClinicalRules(snapshot()).ruleSetVersion).toBe(RULE_SET_VERSION);
  });

  it("reports nothing when no rule matches the plan", () => {
    const result = runClinicalRules(
      snapshot({ diagnosisLabels: ["Type 2 diabetes mellitus"], medicationNames: ["Vitamin D"] })
    );
    expect(result.signals).toEqual([]);
    expect(result.overallRisk).toBe("green");
  });

  describe("missing data", () => {
    it("names what is missing instead of assuming it is fine", () => {
      const result = runClinicalRules(
        snapshot({ diagnosisLabels: ["Type 2 diabetes mellitus"], medicationNames: ["Metformin"] })
      );
      expect(result.missingData).toContain(LAB_FIELDS.egfr);
      expect(result.missingData).toContain(LAB_FIELDS.creatinine);
      expect(result.overallRisk).toBe("yellow");
    });

    it("stops calling data missing once it is on file", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Metformin"],
          labValues: { [LAB_FIELDS.egfr]: 88, [LAB_FIELDS.creatinine]: 0.9 },
        })
      );
      expect(result.missingData).toEqual([]);
      expect(result.overallRisk).toBe("green");
      expect(result.signals[0].explanation).not.toMatch(/missing/i);
    });
  });

  describe("thresholds", () => {
    it("treats metformin below eGFR 30 as high-priority", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Metformin"],
          labValues: { [LAB_FIELDS.egfr]: 24, [LAB_FIELDS.creatinine]: 2.4 },
        })
      );
      expect(result.overallRisk).toBe("red");
      expect(result.signals[0].explanation).toContain("24");
    });

    it("treats the 30-45 eGFR band as monitoring, not contraindication", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Metformin"],
          labValues: { [LAB_FIELDS.egfr]: 42, [LAB_FIELDS.creatinine]: 1.6 },
        })
      );
      expect(result.overallRisk).toBe("yellow");
      expect(result.signals[0].observed).toContainEqual(
        expect.objectContaining({ field: LAB_FIELDS.egfr, value: 42 })
      );
    });

    it("quotes the measured potassium back when an ACE inhibitor is proposed", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Arterial hypertension"],
          medicationNames: ["Lisinopril"],
          labValues: { [LAB_FIELDS.potassium]: 5.7, [LAB_FIELDS.creatinine]: 1.1 },
        })
      );
      expect(result.overallRisk).toBe("red");
      expect(result.signals.some((signal) => signal.explanation.includes("5.7"))).toBe(true);
    });
  });

  describe("interactions and duplicates", () => {
    it("flags the ACE inhibitor + diuretic + NSAID combination", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Arterial hypertension"],
          medicationNames: ["Ibuprofen"],
          existingMedicationNames: ["Lisinopril", "Hydrochlorothiazide"],
          labValues: { [LAB_FIELDS.creatinine]: 1.0 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).toContain("TRIPLE_WHAMMY_RENAL");
      expect(result.overallRisk).toBe("red");
    });

    it("ignores an interaction that exists only among medications already taken", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Arterial hypertension"],
          medicationNames: ["Atorvastatin"],
          existingMedicationNames: ["Lisinopril", "Hydrochlorothiazide", "Ibuprofen"],
          labValues: { [LAB_FIELDS.alt]: 20, [LAB_FIELDS.ast]: 21 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).not.toContain("TRIPLE_WHAMMY_RENAL");
    });

    it("flags two medications from the same class", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Gliclazide"],
          existingMedicationNames: ["Glimepiride"],
          labValues: { [LAB_FIELDS.hba1c]: 8.1 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).toContain("DUAL_GLUCOSE_LOWERING_DUPLICATE");
    });
  });

  describe("allergies", () => {
    it("flags a medication the patient is recorded as allergic to", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Arterial hypertension"],
          medicationNames: ["Lisinopril"],
          allergySubstances: ["Lisinopril"],
          labValues: { [LAB_FIELDS.potassium]: 4.2, [LAB_FIELDS.creatinine]: 0.9 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).toContain("ALLERGY_CONFLICT_DIRECT");
      expect(result.overallRisk).toBe("red");
    });

    it("flags a sulfonylurea against a recorded sulfonamide allergy", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Gliclazide"],
          allergySubstances: ["Sulfonamide antibiotics"],
          labValues: { [LAB_FIELDS.hba1c]: 8.4 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).toContain("ALLERGY_CONFLICT_SULFONAMIDE");
    });

    it("does not flag an unrelated allergy", () => {
      const result = runClinicalRules(
        snapshot({
          diagnosisLabels: ["Type 2 diabetes mellitus"],
          medicationNames: ["Metformin"],
          allergySubstances: ["Peanuts"],
          labValues: { [LAB_FIELDS.egfr]: 90, [LAB_FIELDS.creatinine]: 0.8 },
        })
      );
      expect(result.signals.map((signal) => signal.ruleCode)).not.toContain("ALLERGY_CONFLICT_DIRECT");
      expect(result.overallRisk).toBe("green");
    });
  });

  it("reports the worst finding as the overall risk", () => {
    const result = runClinicalRules(
      snapshot({
        diagnosisLabels: ["Type 2 diabetes mellitus", "Arterial hypertension"],
        medicationNames: ["Metformin", "Ibuprofen"],
        labValues: { [LAB_FIELDS.egfr]: 88, [LAB_FIELDS.creatinine]: 0.9 },
      })
    );
    expect(result.overallRisk).toBe("red");
    expect(result.affectedOrgans).toContain("kidney");
  });
});
