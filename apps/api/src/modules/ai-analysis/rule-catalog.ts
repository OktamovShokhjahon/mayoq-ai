import type { RiskColor } from "../../shared/types";

/**
 * Versioned, hand-authored deterministic rule catalog. This is intentionally
 * NOT AI-generated: the AI layer explains these results, it never invents them.
 *
 * Every threshold below restates ordinary prescribing guidance for the MVP's
 * two conditions and must be signed off by the clinic's own medical reviewer
 * before use on real patients — the version string is what an analysis records,
 * so a catalog change is always traceable to the analyses it produced.
 */
export const RULE_SET_VERSION = "2026.09.2";

/** Canonical lab field names. Records must store values under these keys. */
export const LAB_FIELDS = {
  hba1c: "latestHba1c",
  egfr: "latestEgfr",
  creatinine: "latestCreatinine",
  potassium: "latestPotassium",
  alt: "latestAlt",
  ast: "latestAst",
  systolicBp: "latestSystolicBp",
} as const;

/** Human labels for every field a rule can ask for. Never show the key. */
export const FIELD_LABELS: Record<string, string> = {
  latestHba1c: "latest HbA1c",
  latestEgfr: "latest eGFR",
  latestCreatinine: "latest creatinine",
  latestPotassium: "latest potassium",
  latestAlt: "latest ALT",
  latestAst: "latest AST",
  latestSystolicBp: "latest systolic blood pressure",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/^latest/, "latest ").replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

export type ThresholdOperator = "lt" | "lte" | "gt" | "gte";

export interface ThresholdCheck {
  field: string;
  /**
   * Suffix of this branch's message key, so the console can render the finding
   * in the reader's language. The engine emits `rule.<code>.<key>`; the English
   * `explanation` below travels with it as the fallback.
   */
  key: string;
  op: ThresholdOperator;
  value: number;
  severity: RiskColor;
  /** Reads with the measured value substituted for {value}. */
  explanation: string;
}

export type RuleKind = "condition_medication" | "medication_medication" | "duplicate_therapy" | "allergy_conflict";

export interface RuleDefinition {
  code: string;
  description: string;
  kind: RuleKind;
  /** Diagnosis gate. Omitted when a rule applies regardless of diagnosis. */
  diagnosisMatch?: RegExp;
  medicationMatch: RegExp;
  /** Second medication, for interaction and duplicate-therapy rules. */
  secondMedicationMatch?: RegExp;
  /** Third medication, for the rules that only bite as a combination. */
  thirdMedicationMatch?: RegExp;
  /** Allergy substances or classes that conflict with `medicationMatch`. */
  allergyMatch?: RegExp;
  requiredFields: string[];
  thresholds?: ThresholdCheck[];
  organsAffected: string[];
  /** Severity when the required data is present and no threshold is crossed. */
  baselineSeverity: RiskColor;
  /** Severity when required data is missing — never lower than baseline. */
  missingDataSeverity: RiskColor;
  /** Shown when required data is missing. */
  missingExplanation: string;
  /** Shown when the data is there and nothing is out of range. */
  satisfiedExplanation: string;
  /** Deterministic monitoring note, shown with every signal this rule raises. */
  monitoring?: string;
}

export const RULE_CATALOG: RuleDefinition[] = [
  {
    code: "T2DM_METFORMIN_RENAL",
    description: "Metformin dosing depends on current renal function in type 2 diabetes.",
    kind: "condition_medication",
    diagnosisMatch: /diabetes/i,
    medicationMatch: /metformin/i,
    requiredFields: [LAB_FIELDS.egfr, LAB_FIELDS.creatinine],
    thresholds: [
      {
        field: LAB_FIELDS.egfr,
        key: "egfrContra",
        op: "lt",
        value: 30,
        severity: "red",
        explanation:
          "eGFR is {value} mL/min/1.73m², below the threshold at which standard labeling treats metformin as contraindicated.",
      },
      {
        field: LAB_FIELDS.egfr,
        key: "egfrReduced",
        op: "lt",
        value: 45,
        severity: "yellow",
        explanation:
          "eGFR is {value} mL/min/1.73m². In this range standard guidance is to review the metformin dose and monitor renal function more closely.",
      },
    ],
    organsAffected: ["kidney"],
    baselineSeverity: "green",
    missingDataSeverity: "yellow",
    missingExplanation:
      "Metformin is renally cleared. The available history is missing recent kidney-function values, so renal risk cannot be fully assessed.",
    satisfiedExplanation:
      "Recent renal function is on file and sits in the range where standard metformin dosing applies.",
    monitoring: "Recheck eGFR and creatinine at least annually, or sooner if renal function changes.",
  },
  {
    code: "HTN_ACEI_RENAL_POTASSIUM",
    description: "ACE inhibitors require renal function and potassium monitoring in hypertension.",
    kind: "condition_medication",
    diagnosisMatch: /hypertension/i,
    medicationMatch: /(lisinopril|enalapril|ramipril|perindopril|ace inhibitor)/i,
    requiredFields: [LAB_FIELDS.potassium, LAB_FIELDS.creatinine],
    thresholds: [
      {
        field: LAB_FIELDS.potassium,
        key: "potassiumHigh",
        op: "gte",
        value: 5.5,
        severity: "red",
        explanation: "Potassium is {value} mmol/L. Starting or continuing an ACE inhibitor at this level needs review first.",
      },
      {
        field: LAB_FIELDS.potassium,
        key: "potassiumUpper",
        op: "gte",
        value: 5.0,
        severity: "yellow",
        explanation: "Potassium is {value} mmol/L, at the upper end. ACE inhibitors can raise it further.",
      },
      {
        field: LAB_FIELDS.egfr,
        key: "egfrLow",
        op: "lt",
        value: 30,
        severity: "yellow",
        explanation: "eGFR is {value} mL/min/1.73m². Renal perfusion effects of ACE inhibition matter more at this level.",
      },
    ],
    organsAffected: ["kidney", "cardiovascular_system"],
    baselineSeverity: "green",
    missingDataSeverity: "yellow",
    missingExplanation:
      "ACE inhibitors can raise potassium and affect renal perfusion. Baseline potassium and creatinine are required before initiation.",
    satisfiedExplanation: "Baseline potassium and renal function are on file and within the usual range for ACE inhibitor use.",
    monitoring: "Recheck potassium and creatinine 1–2 weeks after starting or after a dose increase.",
  },
  {
    code: "NSAID_HYPERTENSION_INTERACTION",
    description: "NSAIDs may counteract blood pressure control and stress the kidneys.",
    kind: "condition_medication",
    diagnosisMatch: /hypertension/i,
    medicationMatch: /(ibuprofen|naproxen|diclofenac|nsaid)/i,
    requiredFields: [],
    organsAffected: ["kidney", "cardiovascular_system"],
    baselineSeverity: "red",
    missingDataSeverity: "red",
    missingExplanation:
      "NSAIDs can raise blood pressure and reduce the effectiveness of antihypertensive therapy, and add renal load.",
    satisfiedExplanation:
      "NSAIDs can raise blood pressure and reduce the effectiveness of antihypertensive therapy, and add renal load.",
    monitoring: "If an NSAID is unavoidable, keep it short, and recheck blood pressure and renal function during use.",
  },
  {
    code: "TRIPLE_WHAMMY_RENAL",
    description: "An ACE inhibitor or ARB with a diuretic and an NSAID together carry a recognised acute renal risk.",
    kind: "medication_medication",
    medicationMatch: /(lisinopril|enalapril|ramipril|perindopril|losartan|valsartan|ace inhibitor|arb)/i,
    secondMedicationMatch: /(hydrochlorothiazide|indapamide|furosemide|thiazide|diuretic)/i,
    thirdMedicationMatch: /(ibuprofen|naproxen|diclofenac|nsaid)/i,
    requiredFields: [LAB_FIELDS.creatinine],
    organsAffected: ["kidney"],
    baselineSeverity: "red",
    missingDataSeverity: "red",
    missingExplanation:
      "This plan combines a renin-angiotensin blocker, a diuretic and an NSAID — the combination carries a recognised risk of acute kidney injury.",
    satisfiedExplanation:
      "This plan combines a renin-angiotensin blocker, a diuretic and an NSAID — the combination carries a recognised risk of acute kidney injury.",
    monitoring: "Avoid the combination where possible; if unavoidable, check renal function within days, not weeks.",
  },
  {
    code: "SULFONYLUREA_HYPOGLYCEMIA",
    description: "Sulfonylureas carry hypoglycemia risk, especially at low HbA1c or with renal impairment.",
    kind: "condition_medication",
    diagnosisMatch: /diabetes/i,
    medicationMatch: /(glipizide|glyburide|glimepiride|gliclazide|sulfonylurea)/i,
    requiredFields: [LAB_FIELDS.hba1c],
    thresholds: [
      {
        field: LAB_FIELDS.hba1c,
        key: "hba1cLow",
        op: "lt",
        value: 7,
        severity: "yellow",
        explanation: "HbA1c is {value}%. Adding or continuing a sulfonylurea at this level raises hypoglycemia risk.",
      },
      {
        field: LAB_FIELDS.egfr,
        key: "egfrClearance",
        op: "lt",
        value: 45,
        severity: "yellow",
        explanation: "eGFR is {value} mL/min/1.73m². Reduced clearance prolongs sulfonylurea action and hypoglycemia risk.",
      },
    ],
    organsAffected: ["pancreas", "nervous_system"],
    baselineSeverity: "green",
    missingDataSeverity: "yellow",
    missingExplanation:
      "Sulfonylureas increase insulin secretion and carry hypoglycemia risk; recent HbA1c helps calibrate dosing safety.",
    satisfiedExplanation: "Recent HbA1c is on file and sits where standard sulfonylurea dosing applies.",
    monitoring: "Ask about hypoglycemia symptoms at each follow-up, particularly with irregular meals.",
  },
  {
    code: "DUAL_GLUCOSE_LOWERING_DUPLICATE",
    description: "Two sulfonylureas together duplicate the same mechanism without added benefit.",
    kind: "duplicate_therapy",
    medicationMatch: /(glipizide|glyburide|glimepiride|gliclazide|sulfonylurea)/i,
    secondMedicationMatch: /(glipizide|glyburide|glimepiride|gliclazide|sulfonylurea)/i,
    requiredFields: [],
    organsAffected: ["pancreas"],
    baselineSeverity: "red",
    missingDataSeverity: "red",
    missingExplanation:
      "The plan contains two medications from the same class. Duplicate therapy adds hypoglycemia risk without added glucose-lowering benefit.",
    satisfiedExplanation:
      "The plan contains two medications from the same class. Duplicate therapy adds hypoglycemia risk without added glucose-lowering benefit.",
    monitoring: "Review whether both are intended before the plan is issued.",
  },
  {
    code: "STATIN_LIVER_MONITORING",
    description: "Statins require baseline and periodic liver function monitoring.",
    kind: "condition_medication",
    diagnosisMatch: /(diabetes|hypertension)/i,
    medicationMatch: /(atorvastatin|simvastatin|rosuvastatin|statin)/i,
    requiredFields: [LAB_FIELDS.alt, LAB_FIELDS.ast],
    thresholds: [
      {
        field: LAB_FIELDS.alt,
        key: "altHigh",
        op: "gt",
        value: 120,
        severity: "red",
        explanation: "ALT is {value} U/L, above three times the usual upper limit. Statin initiation is normally deferred until this is explained.",
      },
      {
        field: LAB_FIELDS.alt,
        key: "altRaised",
        op: "gt",
        value: 40,
        severity: "yellow",
        explanation: "ALT is {value} U/L, above the usual reference range. Worth an explanation before starting a statin.",
      },
    ],
    organsAffected: ["liver"],
    baselineSeverity: "green",
    missingDataSeverity: "yellow",
    missingExplanation:
      "Statins are generally well tolerated but warrant baseline liver enzyme monitoring per standard practice.",
    satisfiedExplanation: "Baseline liver enzymes are on file and within the usual reference range.",
    monitoring: "Recheck liver enzymes if the patient reports unexplained muscle pain or malaise.",
  },
  {
    code: "ALLERGY_CONFLICT_SULFONAMIDE",
    description: "A recorded sulfonamide allergy conflicts with sulfonylurea therapy.",
    kind: "allergy_conflict",
    medicationMatch: /(glipizide|glyburide|glimepiride|gliclazide|sulfonylurea)/i,
    allergyMatch: /(sulfa|sulfonamide|sulphonamide)/i,
    requiredFields: [],
    organsAffected: ["pancreas"],
    baselineSeverity: "red",
    missingDataSeverity: "red",
    missingExplanation:
      "This patient has a sulfonamide allergy on file and the plan contains a sulfonylurea, which shares that structure.",
    satisfiedExplanation:
      "This patient has a sulfonamide allergy on file and the plan contains a sulfonylurea, which shares that structure.",
    monitoring: "Confirm the reaction history before prescribing, and record the decision.",
  },
  {
    code: "ALLERGY_CONFLICT_DIRECT",
    description: "The proposed medication matches a substance recorded as an allergy.",
    kind: "allergy_conflict",
    // Matched by name against the allergy list, so the pattern is open here and
    // the engine compares the actual strings.
    medicationMatch: /.*/,
    requiredFields: [],
    organsAffected: ["immune_system"],
    baselineSeverity: "red",
    missingDataSeverity: "red",
    missingExplanation: "The proposed medication is recorded as an allergy for this patient.",
    satisfiedExplanation: "The proposed medication is recorded as an allergy for this patient.",
    monitoring: "Do not proceed without confirming the allergy record is accurate.",
  },
];
