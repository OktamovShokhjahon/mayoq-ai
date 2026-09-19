import { describe, expect, it } from "vitest";
import { extractFactsDeterministically } from "./deterministic-extraction";

const REPORT = `CENTRAL CLINIC LABORATORY
Patient: Synthetic Patient Alpha
Diagnosis on file: Type 2 diabetes mellitus
HbA1c: 8.4 %
eGFR: 42 mL/min/1.73m2
Creatinine: 1.6 mg/dL
Current therapy: Metformin 500mg twice daily`;

describe("deterministic extraction (AI-unavailable fallback)", () => {
  it("reads the values that are literally in the text", () => {
    const result = extractFactsDeterministically(REPORT);
    const labs = result.candidateFacts.filter((fact) => fact.type === "lab_result");
    expect(labs.map((fact) => [fact.description, fact.value])).toEqual(
      expect.arrayContaining([
        ["HbA1c", 8.4],
        ["eGFR", 42],
        ["Creatinine", 1.6],
      ]),
    );
  });

  it("quotes the source line for every fact it reports", () => {
    const result = extractFactsDeterministically(REPORT);
    expect(result.candidateFacts.length).toBeGreaterThan(0);
    for (const fact of result.candidateFacts) {
      expect(fact.sourceSpan.length).toBeGreaterThan(0);
      expect(REPORT).toContain(fact.sourceSpan);
    }
  });

  it("finds the medication and the diagnosis named in the text", () => {
    const result = extractFactsDeterministically(REPORT);
    expect(result.candidateFacts.some((fact) => fact.type === "medication" && /metformin/i.test(fact.description))).toBe(true);
    expect(result.candidateFacts.some((fact) => fact.type === "diagnosis" && fact.description === "Type 2 diabetes mellitus")).toBe(true);
  });

  it("invents nothing when the text holds no clinical values", () => {
    const result = extractFactsDeterministically("Appointment confirmation. Please arrive ten minutes early.");
    expect(result.candidateFacts).toEqual([]);
    expect(result.missingOrUnclear.join(" ")).toMatch(/no recognised clinical values/i);
  });

  it("always says the model was not the source", () => {
    const result = extractFactsDeterministically(REPORT);
    expect(result.missingOrUnclear.join(" ")).toMatch(/model was unavailable/i);
  });
});
