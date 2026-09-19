import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { connectDb, disconnectDb } from "../config/db";
import { logger } from "../config/logger";
import { Tenant } from "../modules/tenants/tenant.model";
import { PatientProfile } from "../modules/patients/patient.model";
import { Diagnosis } from "../modules/diagnoses/diagnosis.model";
import { Medication } from "../modules/medications/medication.model";
import { MedicalRecord } from "../modules/medical-records/medical-record.model";
import { TreatmentScenario } from "../modules/ai-analysis/treatment-scenario.model";
import { callGeminiStructured } from "../modules/ai-analysis/gemini.client";
import { SPEC_BY_FIELD } from "../modules/deep-analysis/trend-engine";

/**
 * Exports the seeded demo clinic into a snapshot the public marketing pages
 * read. The landing page has no database and no session, so without this it
 * would need its own hand-written cases — which is exactly what it used to
 * have. Everything here comes from the generated patients and the findings the
 * rule engine produced from them, so the public page and the signed-in console
 * show the same data, and none of it was written by hand.
 *
 * Run after the seed:  npx tsx src/jobs/export-demo-snapshot.ts
 */

const OUT = path.resolve(__dirname, "../../../web/lib/generated/demo-snapshot.json");

const LANGS = ["uz", "en", "ru"] as const;

const PROSE = z.object({
  cases: z.array(
    z.object({
      patientCode: z.string(),
      uz: z.object({ tab: z.string(), summary: z.string(), trendLabel: z.string(), drivers: z.array(z.string()).min(2).max(4) }),
      en: z.object({ tab: z.string(), summary: z.string(), trendLabel: z.string(), drivers: z.array(z.string()).min(2).max(4) }),
      ru: z.object({ tab: z.string(), summary: z.string(), trendLabel: z.string(), drivers: z.array(z.string()).min(2).max(4) }),
    })
  ),
});

function ageFrom(dob?: Date | null): number | undefined {
  if (!dob) return undefined;
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000));
  return Number.isFinite(years) && years > 0 ? years : undefined;
}

async function main() {
  await connectDb();
  const tenant = await Tenant.findOne({ slug: "twinrx-demo-clinic" });
  if (!tenant) throw new Error("No demo clinic found. Run the seed first.");

  const profiles = await PatientProfile.find({ tenantId: tenant._id }).sort({ createdAt: 1 }).lean();
  if (profiles.length === 0) throw new Error("The demo clinic has no patients. Run the seed first.");

  const cases = [];
  for (const profile of profiles) {
    const [diagnoses, medications, records, scenario] = await Promise.all([
      Diagnosis.find({ tenantId: tenant._id, patientId: profile._id }).lean(),
      Medication.find({ tenantId: tenant._id, patientId: profile._id, status: "active" }).lean(),
      MedicalRecord.find({ tenantId: tenant._id, patientId: profile._id, type: "lab_result" }).sort({ eventDate: 1 }).lean(),
      TreatmentScenario.findOne({ tenantId: tenant._id, patientId: profile._id }).sort({ createdAt: -1 }).lean(),
    ]);

    // The measurement with the most readings is the one worth charting: it is
    // the only one with a shape to show.
    const byField = new Map<string, Array<{ date: string; value: number }>>();
    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const field = typeof data.field === "string" ? data.field : undefined;
      const value = typeof data.value === "number" ? data.value : undefined;
      if (!field || value === undefined) continue;
      byField.set(field, [...(byField.get(field) ?? []), { date: new Date(record.eventDate).toISOString(), value }]);
    }
    const [field, series] = [...byField.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    if (!field || !series || series.length < 2) {
      logger.warn({ patientCode: profile.patientCode }, "Skipped: no measurement with enough readings to chart");
      continue;
    }
    const spec = SPEC_BY_FIELD[field];

    cases.push({
      patientCode: profile.patientCode,
      age: ageFrom(profile.dateOfBirth),
      sex: profile.sex,
      diagnoses: diagnoses.map((d) => d.label),
      medications: medications.map((m) => `${m.genericName} ${m.dosage} ${m.unit}`),
      field,
      unit: spec?.unit ?? "",
      better: spec?.better ?? "lower",
      target: spec?.target ?? 0,
      series: series.map((point) => ({ date: point.date.slice(0, 10), value: point.value })),
      // Straight from the rule engine: organ, colour and the rule's own words.
      organs: (scenario?.signals ?? []).map((signal) => ({
        organ: signal.organ,
        color: signal.color,
        explanation: signal.explanation,
        ruleCode: signal.ruleCode ?? null,
      })),
      overallRisk: scenario?.overallRisk ?? null,
      ruleSetVersion: scenario?.ruleSetVersion ?? null,
    });
  }

  // One call for all three cases in all three languages: the page is
  // translated, so the prose has to be.
  const result = await callGeminiStructured({
    promptVersion: "demo-snapshot-prose@1",
    temperature: 0.4,
    schema: PROSE,
    systemPrompt: [
      "You write the short public-facing description of synthetic demo patients for a clinical decision-support product.",
      "You are given each case's real data and the findings a deterministic rule engine produced from it.",
      "Use ONLY that input. Never add a number, medicine, condition, risk or conclusion that is not in it, and never soften or contradict a rule's finding.",
      "For each case write, in each of Uzbek (Latin script), English and Russian:",
      "- tab: 2 to 4 words naming the case, for a tab label. Name the condition, not the patient.",
      "- summary: one line, at most 12 words: age, condition, current therapy.",
      "- trendLabel: the charted measurement with its unit, e.g. 'HbA1c, %'.",
      "- drivers: 2 to 4 short sentences saying what the numbers did and what the rules flagged. Quote the measured values given. Say plainly that a red or amber finding is for a physician to confirm, not a diagnosis.",
      "Keep every language's content equivalent; do not add a fact to one language only.",
      'Return strict JSON: {"cases":[{"patientCode":string,"uz":{...},"en":{...},"ru":{...}}]}.',
    ].join("\n"),
    userPrompt: JSON.stringify(
      cases.map((item) => ({
        patientCode: item.patientCode,
        age: item.age,
        conditions: item.diagnoses,
        medications: item.medications,
        chartedMeasurement: { name: SPEC_BY_FIELD[item.field]?.label ?? item.field, unit: item.unit, target: item.target, betterWhen: item.better },
        readings: item.series,
        ruleFindings: item.organs,
        overallRisk: item.overallRisk,
      }))
    ),
  });

  if (!result.ok || !result.data) {
    throw new Error(`Prose generation failed, so no snapshot was written: ${result.error ?? "unknown AI error"}`);
  }

  const proseByCode = new Map(result.data.cases.map((item) => [item.patientCode, item]));
  const snapshot = {
    generatedAt: new Date().toISOString(),
    modelId: result.modelId,
    ruleSetVersion: cases[0]?.ruleSetVersion ?? null,
    cases: cases.map((item) => {
      const prose = proseByCode.get(item.patientCode);
      if (!prose) throw new Error(`The model returned no prose for ${item.patientCode}`);
      return {
        ...item,
        text: Object.fromEntries(LANGS.map((lang) => [lang, prose[lang]])),
      };
    }),
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  logger.info({ out: OUT, cases: snapshot.cases.length, modelId: snapshot.modelId }, "Demo snapshot written");

  await disconnectDb();
}

main().catch((err) => {
  logger.error({ err }, "Snapshot export failed");
  process.exit(1);
});
