import { z } from "zod";
import { callGeminiStructured } from "../modules/ai-analysis/gemini.client";
import { SPEC_BY_FIELD, TREND_SPECS } from "../modules/deep-analysis/trend-engine";

/**
 * Generates the clinical content of the demo clinic with the model, so no
 * lab value, diagnosis or medication in the seeded database was written by
 * hand. Only the sign-in details stay fixed, because a demo nobody can log
 * into is no demo at all.
 *
 * What the model may decide: which conditions each synthetic patient has,
 * what they take, what they are allergic to, and the shape of their results
 * over time. What it may NOT decide: whether an organ is green, amber or red.
 * That still comes from the deterministic rule catalog running over these
 * values, which is the whole safety claim of the product — so this generator
 * produces *inputs*, and the existing pipeline produces the findings.
 *
 * Nothing here falls back to hand-written data. If the model is unavailable
 * the seed fails loudly, because a demo that silently reverts to canned
 * numbers while claiming to be generated is worse than no demo.
 */

const PROMPT_VERSION = "demo-case-generator@1";

/** Canonical lab keys the rules and charts understand. The model may use no others. */
const LAB_FIELDS = TREND_SPECS.map((spec) => spec.field) as [string, ...string[]];

const READING = z.object({
  field: z.enum(LAB_FIELDS),
  /** Days before today. Dates are computed here; models are unreliable at arithmetic on them. */
  daysAgo: z.number().int().min(0).max(900),
  value: z.number(),
  unit: z.string().min(1).max(16),
});

const CASE = z.object({
  /** Which seeded login this case belongs to. */
  slot: z.enum(["alpha", "beta", "gamma"]),
  patientCode: z.string().min(3).max(24),
  birthYear: z.number().int().min(1930).max(2010),
  sex: z.enum(["male", "female", "other", "unknown"]),
  smokingStatus: z.enum(["never", "former", "current", "unknown"]),
  heightCm: z.number().min(120).max(220).optional(),
  weightKg: z.number().min(35).max(220).optional(),
  diagnoses: z
    .array(
      z.object({
        label: z.string().min(3).max(120),
        diagnosedDaysAgo: z.number().int().min(30).max(7300),
      })
    )
    .min(1)
    .max(3),
  medications: z
    .array(
      z.object({
        genericName: z.string().min(3).max(60),
        dosage: z.number().positive().max(5000),
        unit: z.string().min(1).max(12),
        route: z.string().min(2).max(24),
        frequency: z.string().min(2).max(40),
        purpose: z.string().min(3).max(80),
        /**
         * True for a medicine the doctor is considering rather than one the
         * patient already takes. The demo needs at least one, because a
         * proposed drug is what the product is built to check.
         */
        proposed: z.boolean().default(false),
      })
    )
    .min(1)
    .max(4),
  allergies: z
    .array(
      z.object({
        substance: z.string().min(2).max(60),
        reaction: z.string().min(2).max(60),
        severity: z.enum(["mild", "moderate", "severe", "unknown"]),
      })
    )
    .max(2)
    .default([]),
  /** Serial results. At least one measurement needs enough points to draw a trend. */
  readings: z.array(READING).min(3).max(24),
  /** Projection window the seeded analysis should use, in days. */
  horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
});

const CASES = z.object({ cases: z.array(CASE).length(3) });

export type GeneratedCase = z.output<typeof CASE>;
export type GeneratedReading = z.output<typeof READING>;

/**
 * The vocabulary the deterministic rules can actually match. Without this the
 * model invents plausible but unmatched drug names, no rule fires, and the demo
 * shows an empty analysis. Naming the domain is not the same as scripting the
 * result: the model still chooses the combination, the doses and the values,
 * and which rules fire follows from those choices.
 */
const DOMAIN = {
  conditions: ["Type 2 diabetes mellitus", "Arterial hypertension"],
  medications: {
    biguanide: ["Metformin"],
    aceInhibitor: ["Lisinopril", "Enalapril", "Ramipril", "Perindopril"],
    arb: ["Losartan", "Valsartan"],
    diuretic: ["Hydrochlorothiazide", "Indapamide", "Furosemide"],
    sulfonylurea: ["Glipizide", "Glyburide", "Glimepiride", "Gliclazide"],
    statin: ["Atorvastatin", "Simvastatin", "Rosuvastatin"],
    nsaid: ["Ibuprofen", "Naproxen", "Diclofenac"],
  },
  labs: TREND_SPECS.map((spec) => ({
    field: spec.field,
    meaning: spec.label,
    unit: spec.unit,
    usualTarget: `${spec.better === "lower" ? "at or below" : "at or above"} ${spec.target}`,
    plausibleRange: spec.plausible,
  })),
};

const SYSTEM_PROMPT = [
  "You invent synthetic patient cases for a clinical decision-support demo.",
  "Every case is fictional and must not resemble a real, identifiable person: no real names, no real clinic, no real record numbers.",
  "You are writing the INPUTS to a clinical rules engine, not its conclusions. Do not state risks, findings or organ assessments; the rules derive those from the values you choose.",
  "",
  "Make the three cases clinically coherent and clearly different from each other:",
  "- One should be improving on treatment: a measurement that moves steadily towards its target.",
  "- One should be plateaued or drifting: a measurement that stays off target.",
  "- One should be deteriorating: a measurement moving away from its target, with a newly proposed medicine that a prescriber would want checked against the rest of the record.",
  "",
  "Rules for the values themselves:",
  "- Use only the canonical lab field names supplied. Use each field's stated unit exactly.",
  "- Give at least one measurement per patient a run of 4 or more readings spread over 120 days or more, so a trend can be fitted. Vary the spacing; real results are not evenly spaced.",
  "- Keep every value inside the stated plausible range and inside what that measurement physically does. Changes between consecutive readings must be gradual and physiologically believable.",
  "- Doses must be ordinary adult doses for the drug named.",
  "- A medication must be consistent with a diagnosis you gave the same patient.",
  "- Give each patient exactly one proposed medication and mark it proposed: true. The rest are current therapy.",
  "- patientCode must look like a demo identifier and must contain the word DEMO.",
  "",
  "Return strict JSON with a top-level `cases` array holding exactly three objects, one per slot: alpha, beta, gamma.",
  "Every field shown below is required on every case. Use exactly these key names and this nesting, and put every value at the depth shown:",
  JSON.stringify(
    {
      cases: [
        {
          slot: "alpha",
          patientCode: "PT-DEMO-X1",
          birthYear: 1968,
          sex: "female",
          smokingStatus: "former",
          heightCm: 164,
          weightKg: 78,
          diagnoses: [{ label: "Type 2 diabetes mellitus", diagnosedDaysAgo: 1460 }],
          medications: [
            {
              genericName: "Metformin",
              dosage: 1000,
              unit: "mg",
              route: "oral",
              frequency: "twice daily",
              purpose: "Glycaemic control",
              proposed: false,
            },
            {
              genericName: "Atorvastatin",
              dosage: 20,
              unit: "mg",
              route: "oral",
              frequency: "once daily",
              purpose: "Cardiovascular risk reduction",
              proposed: true,
            },
          ],
          allergies: [{ substance: "Penicillin", reaction: "Rash", severity: "moderate" }],
          readings: [
            { field: "latestHba1c", daysAgo: 400, value: 8.8, unit: "%" },
            { field: "latestHba1c", daysAgo: 280, value: 8.2, unit: "%" },
            { field: "latestHba1c", daysAgo: 150, value: 7.7, unit: "%" },
            { field: "latestHba1c", daysAgo: 40, value: 7.3, unit: "%" },
            { field: "latestEgfr", daysAgo: 40, value: 82, unit: "ml/min" },
          ],
          horizonDays: 90,
        },
      ],
    },
    null,
    1
  ),
  "That example shows the shape only. Invent different patients, conditions, medicines and values.",
].join("\n");

export interface GeneratedCases {
  cases: GeneratedCase[];
  modelId: string;
}

/** Keeps a generated value inside what the measurement can physically be. */
function clampReading(reading: GeneratedReading): GeneratedReading {
  const spec = SPEC_BY_FIELD[reading.field];
  if (!spec) return reading;
  const [low, high] = spec.plausible;
  return {
    ...reading,
    value: Math.min(high, Math.max(low, reading.value)),
    // The chart labels the axis from the spec, so a mislabelled unit would
    // print a number against the wrong scale.
    unit: spec.unit,
  };
}

/**
 * Asks the model for the whole demo cohort in one call. One call rather than
 * three keeps the cases distinct from each other and stays well inside the
 * free-tier per-minute allowance the seed has to share with the analyses it
 * runs afterwards.
 */
export async function generateDemoCases(): Promise<GeneratedCases> {
  const call = () =>
    callGeminiStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        task: "Invent three synthetic patients for the demo clinic.",
        slots: ["alpha", "beta", "gamma"],
        domainTheRulesUnderstand: DOMAIN,
        today: new Date().toISOString().slice(0, 10),
      }),
      schema: CASES,
      promptVersion: PROMPT_VERSION,
      // High enough that re-seeding gives a genuinely different cohort, low
      // enough that the numbers stay clinically sensible.
      temperature: 0.9,
    });

  // A single malformed generation should not leave the demo clinic empty, and
  // the failure mode here is a drifting JSON shape rather than a broken key,
  // so one more attempt usually lands.
  let result = await call();
  if (!result.ok || !result.data) {
    await new Promise((resolve) => setTimeout(resolve, 6500));
    result = await call();
  }

  if (!result.ok || !result.data) {
    throw new Error(
      `Case generation failed, so nothing was seeded: ${result.error ?? "unknown AI error"}. ` +
        "Set GEMINI_API_KEY (and GEMINI_MODEL if the default is unavailable) and run the seed again."
    );
  }

  // Re-parsed so the optional fields the model may omit come back with their
  // defaults filled in rather than as `undefined`.
  const cases = CASES.parse(result.data).cases.map((item) => ({
    ...item,
    readings: item.readings
      .map(clampReading)
      // Oldest first, so the seeded history reads forward in time.
      .sort((a, b) => b.daysAgo - a.daysAgo),
  }));

  // Each slot must appear exactly once, or a login would end up with no case
  // or with two.
  const slots = new Set(cases.map((item) => item.slot));
  if (slots.size !== 3) {
    throw new Error(`The model returned slots ${[...slots].join(", ")}; expected one case each for alpha, beta and gamma.`);
  }

  return { cases, modelId: result.modelId };
}
