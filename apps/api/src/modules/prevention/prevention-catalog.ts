import { LAB_FIELDS } from "../ai-analysis/rule-catalog";

/**
 * Versioned, hand-authored prevention catalog. Like the clinical rule catalog
 * this is deliberately NOT AI-generated: the model may phrase a program more
 * warmly, it may never invent one, change a threshold, or alter a routine.
 *
 * Hard boundary, enforced by review and by `prevention-engine.test.ts`: nothing
 * in this file may add, stop, or change a dose of any medication. Every program
 * here is behaviour, measurement, or booking an appointment. Medication is the
 * doctor's decision and reaches the patient only through an approved scenario.
 *
 * The thresholds restate ordinary chronic-care guidance for the MVP's two
 * conditions and must be signed off by the clinic's own medical reviewer before
 * use on real patients. The version string is recorded on every generated plan,
 * so a catalog change is traceable to the plans it produced.
 */
export const PREVENTION_SET_VERSION = "2026.09.1";

export type TimeOfDay = "morning" | "midday" | "evening" | "anytime";

export interface RoutineStep {
  timeOfDay: TimeOfDay;
  /** What the patient does. Imperative, plain, one action. */
  action: string;
  /** Why this step, or how to do it. One sentence. */
  detail: string;
}

export interface ExpectedResult {
  /** The window the statement below is measured over. */
  horizonDays: number;
  /**
   * What sustained adherence is typically associated with. Phrased as a range
   * and as an association — never as a promise to this individual.
   */
  statement: string;
  /** The number that would show it working, so the claim stays checkable. */
  measure: string;
}

export type TriggerKind =
  | "lab_threshold"
  | "lab_missing"
  | "diagnosis"
  | "smoking"
  | "bmi";

export interface PreventionProgram {
  code: string;
  /** The suggestion, as the patient will read it. */
  title: string;
  /** The complication this program exists to push away. */
  prevents: string;
  kind: TriggerKind;
  /** Gate on a recorded diagnosis. Omitted when the program is unconditional. */
  diagnosisMatch?: RegExp;
  /** Lab field this program watches, for threshold and missing-value kinds. */
  field?: string;
  op?: "gt" | "gte" | "lt" | "lte";
  value?: number;
  /** Reads with the measured value substituted for {value}. */
  because: string;
  routine: RoutineStep[];
  expected: ExpectedResult;
  /**
   * Priority when several programs fire. Higher sorts first. A program that
   * answers a crossed threshold outranks one that answers a gap in the record.
   */
  weight: number;
}

export const PREVENTION_CATALOG: PreventionProgram[] = [
  {
    code: "HTN_SODIUM_AND_WALKING",
    title: "Bring blood pressure down with salt reduction and daily walking",
    prevents: "Stroke, heart failure and kidney damage from sustained high pressure",
    kind: "lab_threshold",
    diagnosisMatch: /hypertension/i,
    field: LAB_FIELDS.systolicBp,
    op: "gte",
    value: 140,
    because:
      "Your last recorded systolic pressure was {value} mmHg, which is above the usual target of 140.",
    routine: [
      {
        timeOfDay: "morning",
        action: "Measure your blood pressure before breakfast",
        detail: "Sit for five minutes first, and write down both numbers. Same arm each time.",
      },
      {
        timeOfDay: "midday",
        action: "Cook without adding salt at the table",
        detail: "Most salt comes from bread, preserved food and added salt rather than cooking.",
      },
      {
        timeOfDay: "evening",
        action: "Walk 30 minutes at a pace that makes talking slightly hard",
        detail: "Three shorter walks count the same as one long one.",
      },
    ],
    expected: {
      horizonDays: 90,
      statement:
        "Sustained salt reduction with regular walking is typically associated with a fall of roughly 5–8 mmHg in systolic pressure.",
      measure: "Your morning systolic readings, averaged over a week",
    },
    weight: 100,
  },
  {
    code: "T2DM_GLYCAEMIC_ROUTINE",
    title: "Steady your glucose with consistent meals and post-meal movement",
    prevents: "Eye, nerve and kidney damage from sustained high blood sugar",
    kind: "lab_threshold",
    diagnosisMatch: /diabetes/i,
    field: LAB_FIELDS.hba1c,
    op: "gte",
    value: 7,
    because: "Your last recorded HbA1c was {value}%, above the usual target of 7%.",
    routine: [
      {
        timeOfDay: "morning",
        action: "Eat breakfast within an hour of waking",
        detail: "Skipping it tends to push the rest of the day's readings higher.",
      },
      {
        timeOfDay: "midday",
        action: "Walk 10–15 minutes after your largest meal",
        detail: "Movement just after eating blunts the spike more than the same walk later.",
      },
      {
        timeOfDay: "evening",
        action: "Keep the carbohydrate portion the same size each day",
        detail: "Consistency matters more here than cutting carbohydrate sharply.",
      },
    ],
    expected: {
      horizonDays: 90,
      statement:
        "Consistent meal timing with post-meal walking is typically associated with a fall of roughly 0.3–0.7 percentage points in HbA1c.",
      measure: "Your next HbA1c, drawn about three months from now",
    },
    weight: 95,
  },
  {
    code: "SMOKING_CESSATION",
    title: "Stop smoking — this is the single largest change available to you",
    prevents: "Heart attack, stroke and accelerated kidney and eye damage",
    kind: "smoking",
    because: "Your record lists you as a current smoker.",
    routine: [
      {
        timeOfDay: "morning",
        action: "Delay the first cigarette by one hour, and add an hour each week",
        detail: "The first of the day is the most habitual and the most useful one to move.",
      },
      {
        timeOfDay: "anytime",
        action: "Write down the time and trigger of every cigarette you do smoke",
        detail: "Most people find three or four repeating triggers they can plan around.",
      },
      {
        timeOfDay: "evening",
        action: "Ask your doctor about cessation support at your next visit",
        detail: "Support roughly doubles the chance a quit attempt holds.",
      },
    ],
    expected: {
      horizonDays: 90,
      statement:
        "Cardiovascular risk begins falling within weeks of stopping, and continues falling for years afterwards.",
      measure: "Cigarettes per day, recorded daily",
    },
    weight: 110,
  },
  {
    code: "RENAL_MONITORING_GAP",
    title: "Book the kidney-function blood test your record is missing",
    prevents: "Unnoticed kidney decline, and dosing decisions made without it",
    kind: "lab_missing",
    // Gated on the chronic conditions this exists for. Telling someone with no
    // recorded diagnosis to book a kidney test is noise, and noise is what
    // teaches a patient to ignore the rest of the plan.
    diagnosisMatch: /diabetes|hypertension/i,
    field: LAB_FIELDS.egfr,
    because: "There is no recent eGFR on file, so kidney function cannot be assessed.",
    routine: [
      {
        timeOfDay: "anytime",
        action: "Book an eGFR and creatinine blood test this month",
        detail: "It is a single ordinary blood draw, usually fasting is not required.",
      },
      {
        timeOfDay: "anytime",
        action: "Bring the result to your next appointment",
        detail: "Several of your medications are cleared by the kidneys, so this number matters.",
      },
    ],
    expected: {
      horizonDays: 30,
      statement:
        "With the result on file, the system can assess renal risk instead of flagging it as unknown.",
      measure: "An eGFR value recorded in your chart",
    },
    weight: 70,
  },
  {
    code: "RETINAL_SCREENING_GAP",
    title: "Book a retinal screening",
    prevents: "Sight loss from diabetic retinopathy caught too late",
    kind: "diagnosis",
    diagnosisMatch: /diabetes/i,
    because:
      "Diabetes is on your record, and retinal screening is the way eye damage is found while it is still treatable.",
    routine: [
      {
        timeOfDay: "anytime",
        action: "Book a retinal screening if you have not had one in the last 12 months",
        detail: "Early retinopathy has no symptoms — you cannot tell by how your sight feels.",
      },
    ],
    expected: {
      horizonDays: 90,
      statement:
        "Screening does not change your eyes; it changes how early anything found can be treated.",
      measure: "A dated retinal screening result in your chart",
    },
    weight: 60,
  },
  {
    code: "WEIGHT_REDUCTION",
    title: "Lose weight gradually — aim for 5% over three months",
    prevents: "Worsening glucose control and rising blood pressure",
    kind: "bmi",
    // Same reasoning as the renal gap: tied to the conditions this product
    // manages, rather than offered to anyone whose height happens to be known.
    diagnosisMatch: /diabetes|hypertension/i,
    op: "gte",
    value: 30,
    because: "Your recorded height and weight give a BMI of {value}.",
    routine: [
      {
        timeOfDay: "morning",
        action: "Weigh yourself once a week, same day and same time",
        detail: "Daily weighing mostly measures water, and is discouraging for no reason.",
      },
      {
        timeOfDay: "midday",
        action: "Make half your plate vegetables before anything else goes on it",
        detail: "This changes portion size without counting anything.",
      },
      {
        timeOfDay: "evening",
        action: "Stop eating three hours before you sleep",
        detail: "Late eating is the most common hidden source of extra intake.",
      },
    ],
    expected: {
      horizonDays: 90,
      statement:
        "A 5% weight reduction is typically associated with meaningfully better glucose control and a small fall in blood pressure.",
      measure: "Your weekly weight, and your next HbA1c",
    },
    weight: 80,
  },
];
