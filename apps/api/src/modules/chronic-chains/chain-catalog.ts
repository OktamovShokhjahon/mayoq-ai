import { LAB_FIELDS } from "../ai-analysis/rule-catalog";

/**
 * Versioned, hand-authored catalog of chronic-disease chains: which condition
 * a patient already has can lead on to which other condition, and what in
 * their record says the chain has started moving.
 *
 * Like the clinical rule and prevention catalogs this is deliberately NOT
 * AI-generated. A model may word a link warmly and may write the advice inside
 * it, but it may never invent a link, change a threshold, or claim a
 * progression this file does not list. That boundary is what keeps "diabetes
 * can lead to kidney disease" a reviewed clinical statement rather than
 * something a language model produced on the day.
 *
 * Hard boundary, enforced by review and by `chain-engine.test.ts`: nothing here
 * names a medicine, a dose, or a treatment target. Every link describes a
 * mechanism and what to watch. Medication is the doctor's decision and reaches
 * the patient only through an approved treatment scenario.
 *
 * The thresholds restate ordinary chronic-care guidance for the MVP's two
 * conditions and must be signed off by the clinic's own medical reviewer before
 * use on real patients. The version string is recorded on every generated map,
 * so a catalog change is traceable to the maps it produced.
 */
export const CHAIN_SET_VERSION = "2026.09.1";

/** How far along a chain this patient's own record says they are. */
export type ChainStage = "risk" | "early" | "established";

export interface ChainLink {
  code: string;
  /** The condition the patient already has, which starts this chain. */
  from: string;
  /** What it can lead to. Plain clinical English, no code. */
  to: string;
  /** The organ or system the twin highlights for this link. */
  organ: string;
  /** Gate: the chain only exists when the patient carries this diagnosis. */
  diagnosisMatch: RegExp;
  /**
   * A second diagnosis that must ALSO be present. Used for links that only
   * exist when two conditions compound each other.
   */
  alsoRequires?: RegExp;
  /** Recognises that the destination condition is already on the record. */
  establishedMatch?: RegExp;
  /**
   * The reading that says this chain has started moving. Crossing it promotes
   * the link from `risk` to `early`.
   */
  marker?: { field: string; op: "gt" | "gte" | "lt" | "lte"; value: number };
  /** The mechanism, in one reviewed sentence. The model may reword, not replace. */
  mechanism: string;
  /** Higher sorts first when several links fire. */
  weight: number;
}

export const CHAIN_CATALOG: ChainLink[] = [
  {
    code: "T2DM_TO_CKD",
    from: "Type 2 diabetes mellitus",
    to: "Diabetic kidney disease",
    organ: "kidney",
    diagnosisMatch: /diabet/i,
    establishedMatch: /kidney disease|nephropath|ckd|renal failure/i,
    marker: { field: LAB_FIELDS.egfr, op: "lt", value: 60 },
    mechanism:
      "Sustained high blood glucose damages the small filtering vessels of the kidney, so filtering capacity falls slowly and often without symptoms.",
    weight: 100,
  },
  {
    code: "T2DM_TO_RETINOPATHY",
    from: "Type 2 diabetes mellitus",
    to: "Diabetic retinopathy",
    organ: "eyes",
    diagnosisMatch: /diabet/i,
    establishedMatch: /retinopath/i,
    marker: { field: LAB_FIELDS.hba1c, op: "gte", value: 8 },
    mechanism:
      "The same small-vessel damage affects the retina, where it can progress a long way before vision changes are noticed.",
    weight: 80,
  },
  {
    code: "T2DM_TO_NEUROPATHY",
    from: "Type 2 diabetes mellitus",
    to: "Diabetic neuropathy and foot ulceration",
    organ: "nervous_system",
    diagnosisMatch: /diabet/i,
    establishedMatch: /neuropath|foot ulcer/i,
    marker: { field: LAB_FIELDS.hba1c, op: "gte", value: 8 },
    mechanism:
      "Nerve fibres in the feet lose function first, so an injury can go unfelt and become an ulcer before it is seen.",
    weight: 75,
  },
  {
    code: "T2DM_TO_CVD",
    from: "Type 2 diabetes mellitus",
    to: "Coronary and peripheral vascular disease",
    organ: "cardiovascular_system",
    diagnosisMatch: /diabet/i,
    establishedMatch: /coronary|ischaem|ischem|angina|myocardial|peripheral vascular/i,
    mechanism:
      "Diabetes accelerates hardening of the larger arteries, which raises the risk of heart attack and of poor circulation in the legs.",
    weight: 85,
  },
  {
    code: "T2DM_TO_FATTY_LIVER",
    from: "Type 2 diabetes mellitus",
    to: "Fatty liver disease",
    organ: "liver",
    diagnosisMatch: /diabet/i,
    establishedMatch: /fatty liver|steatosis|nafld|hepatitis|cirrhos/i,
    marker: { field: LAB_FIELDS.alt, op: "gt", value: 40 },
    mechanism:
      "Insulin resistance drives fat storage in the liver, which can inflame and scar the tissue over years.",
    weight: 55,
  },
  {
    code: "HTN_TO_CKD",
    from: "Arterial hypertension",
    to: "Hypertensive kidney disease",
    organ: "kidney",
    diagnosisMatch: /hypertens/i,
    establishedMatch: /kidney disease|nephropath|ckd|renal failure/i,
    marker: { field: LAB_FIELDS.egfr, op: "lt", value: 60 },
    mechanism:
      "Persistently high pressure damages the kidney's own vessels, and the damaged kidney then raises blood pressure further.",
    weight: 90,
  },
  {
    code: "HTN_TO_HEART_FAILURE",
    from: "Arterial hypertension",
    to: "Left ventricular hypertrophy and heart failure",
    organ: "heart",
    diagnosisMatch: /hypertens/i,
    establishedMatch: /heart failure|cardiomyopath|ventricular hypertroph/i,
    marker: { field: LAB_FIELDS.systolicBp, op: "gte", value: 140 },
    mechanism:
      "The heart muscle thickens to pump against higher pressure, and a thickened ventricle fills and relaxes less well over time.",
    weight: 95,
  },
  {
    code: "HTN_TO_STROKE",
    from: "Arterial hypertension",
    to: "Stroke and vascular cognitive decline",
    organ: "nervous_system",
    diagnosisMatch: /hypertens/i,
    establishedMatch: /stroke|cerebrovascular|tia|transient ischaemic|transient ischemic/i,
    marker: { field: LAB_FIELDS.systolicBp, op: "gte", value: 160 },
    mechanism:
      "High pressure weakens and narrows the vessels supplying the brain, which is the single largest modifiable cause of stroke.",
    weight: 92,
  },
  {
    code: "CKD_TO_POTASSIUM_RISK",
    from: "Reduced kidney function",
    to: "Potassium handling problems affecting heart rhythm",
    organ: "heart",
    diagnosisMatch: /diabet|hypertens|kidney|renal/i,
    marker: { field: LAB_FIELDS.potassium, op: "gte", value: 5.2 },
    mechanism:
      "A kidney that filters less well clears potassium less well, and potassium outside its usual range disturbs the heart's rhythm.",
    weight: 98,
  },
  {
    code: "T2DM_HTN_COMPOUND",
    from: "Type 2 diabetes with hypertension",
    to: "Accelerated kidney and cardiovascular damage",
    organ: "cardiovascular_system",
    diagnosisMatch: /diabet/i,
    alsoRequires: /hypertens/i,
    mechanism:
      "Each condition worsens the damage the other does to the same vessels, so the two together carry more risk than either alone.",
    weight: 99,
  },
];
