import type { ExtractedFacts } from "./document.service";

/**
 * A parser, not a model. When the model is unreachable the platform must not go
 * quiet and must not invent anything (spec 9.5), so this reads the literal
 * text for a small set of values it can recognise character by character and
 * quotes the line each one came from. Anything it does not recognise is
 * reported as unclear rather than guessed, and every fact it produces still
 * enters the doctor's verification queue as unverified.
 */

interface LabPattern {
  field: string;
  label: string;
  unit?: string;
  pattern: RegExp;
}

const LAB_PATTERNS: LabPattern[] = [
  { field: "latestHba1c", label: "HbA1c", unit: "%", pattern: /\bhba1c\b[^0-9%]{0,20}(\d{1,2}(?:[.,]\d)?)\s*%?/i },
  { field: "latestEgfr", label: "eGFR", unit: "mL/min/1.73m2", pattern: /\begfr\b[^0-9]{0,20}(\d{1,3}(?:[.,]\d)?)/i },
  {
    field: "latestCreatinine",
    label: "Creatinine",
    unit: "mg/dL",
    pattern: /\bcreatinine\b[^0-9]{0,20}(\d{1,3}(?:[.,]\d{1,2})?)/i,
  },
  { field: "latestSystolicBp", label: "Systolic blood pressure", unit: "mmHg", pattern: /\b(\d{2,3})\s*\/\s*\d{2,3}\s*mm\s?hg\b/i },
  { field: "latestPotassium", label: "Potassium", unit: "mmol/L", pattern: /\bpotassium\b[^0-9]{0,20}(\d(?:[.,]\d)?)/i },
  { field: "latestAlt", label: "ALT", unit: "U/L", pattern: /\b(?:alt|alanine aminotransferase)\b[^0-9]{0,20}(\d{1,3})/i },
];

const MEDICATION_NAMES = [
  "metformin",
  "gliclazide",
  "empagliflozin",
  "lisinopril",
  "enalapril",
  "losartan",
  "amlodipine",
  "hydrochlorothiazide",
  "atorvastatin",
  "ibuprofen",
  "naproxen",
  "insulin",
];

const DIAGNOSIS_TERMS: Array<{ term: RegExp; label: string }> = [
  { term: /type\s*2\s*diabetes(\s*mellitus)?/i, label: "Type 2 diabetes mellitus" },
  { term: /\bt2dm\b/i, label: "Type 2 diabetes mellitus" },
  { term: /(arterial\s*)?hypertension/i, label: "Arterial hypertension" },
  { term: /chronic kidney disease|\bckd\b/i, label: "Chronic kidney disease" },
];

/** The line a match sits on, so the doctor can see where a fact came from. */
function lineContaining(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 240);
}

export function extractFactsDeterministically(text: string): ExtractedFacts {
  const facts: ExtractedFacts["candidateFacts"] = [];
  const unclear: string[] = [];

  for (const lab of LAB_PATTERNS) {
    const match = lab.pattern.exec(text);
    if (!match || match.index === undefined) continue;
    facts.push({
      type: "lab_result",
      description: lab.label,
      value: Number(match[1].replace(",", ".")),
      unit: lab.unit,
      sourceSpan: lineContaining(text, match.index),
      confidence: "medium",
    });
  }

  for (const name of MEDICATION_NAMES) {
    const match = new RegExp(`\\b${name}\\b[^\\n]{0,60}`, "i").exec(text);
    if (!match || match.index === undefined) continue;
    facts.push({
      type: "medication",
      description: match[0].trim().slice(0, 120),
      sourceSpan: lineContaining(text, match.index),
      confidence: "medium",
    });
  }

  for (const diagnosis of DIAGNOSIS_TERMS) {
    const match = diagnosis.term.exec(text);
    if (!match || match.index === undefined) continue;
    if (facts.some((fact) => fact.type === "diagnosis" && fact.description === diagnosis.label)) continue;
    facts.push({
      type: "diagnosis",
      description: diagnosis.label,
      sourceSpan: lineContaining(text, match.index),
      confidence: "medium",
    });
  }

  if (facts.length === 0) {
    unclear.push("No recognised clinical values were found in this text by the parser.");
  }
  unclear.push("The model was unavailable, so only values the parser recognises literally are listed.");

  return { documentType: "unknown", candidateFacts: facts, missingOrUnclear: unclear };
}
