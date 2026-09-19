import {
  PREVENTION_CATALOG,
  PREVENTION_SET_VERSION,
  type PreventionProgram,
  type RoutineStep,
  type ExpectedResult,
} from "./prevention-catalog";
import { fieldLabel } from "../ai-analysis/rule-catalog";

/**
 * What the engine is allowed to look at. Deliberately the same shape of
 * verified-only data the clinical rules take: an AI-extracted value a doctor
 * has not approved is not a fact, and must not produce advice either.
 */
export interface PreventionSnapshot {
  diagnosisLabels: string[];
  labValues: Record<string, number | undefined>;
  labUnits?: Record<string, string | undefined>;
  smokingStatus?: "never" | "former" | "current" | "unknown";
  heightCm?: number;
  weightKg?: number;
}

/** A catalog step carrying the message keys the console renders it through. */
export interface PlanRoutineStep extends RoutineStep {
  actionKey: string;
  detailKey: string;
}

/**
 * Every piece of prose here arrives twice: the English the catalog holds, and
 * the message key that names it. The console prefers the key, so a patient
 * reading in Uzbek gets the catalog in Uzbek; the English stays as the fallback
 * for a key the dictionary has not caught up with.
 */
export interface PreventionSuggestion {
  code: string;
  title: string;
  titleKey: string;
  prevents: string;
  preventsKey: string;
  /** Why this patient, quoting the value that triggered it. */
  because: string;
  becauseKey: string;
  becauseVars?: Record<string, string | number>;
  routine: PlanRoutineStep[];
  expected: ExpectedResult & { statementKey: string; measureKey: string };
  /** The value the trigger read, so the suggestion can be checked against data. */
  observed?: { field: string; label: string; value: number; unit?: string };
}

export interface PreventionPlan {
  suggestions: PreventionSuggestion[];
  /**
   * Field names — `latestEgfr`, not "latest eGFR" — that would add or sharpen a
   * suggestion if they were on file. The console labels them in the reader's
   * language, which it cannot do with a sentence already written in English.
   */
  missingData: string[];
  preventionSetVersion: string;
  generatedAt: string;
}

/**
 * One catalog program, rendered as a suggestion. The keys are derived from the
 * program code rather than stored on the catalog: the code already identifies
 * the program uniquely, and a second hand-written identifier is one more thing
 * to get out of step.
 */
function toSuggestion(
  program: PreventionProgram,
  parts?: { value?: number; observed?: PreventionSuggestion["observed"] }
): PreventionSuggestion {
  const value = parts?.value;
  return {
    code: program.code,
    title: program.title,
    titleKey: `prev.${program.code}.title`,
    prevents: program.prevents,
    preventsKey: `prev.${program.code}.prevents`,
    because: value === undefined ? program.because : program.because.replace("{value}", String(value)),
    becauseKey: `prev.${program.code}.because`,
    becauseVars: value === undefined ? undefined : { value },
    routine: program.routine.map((step, index) => ({
      ...step,
      actionKey: `prev.${program.code}.step${index}.action`,
      detailKey: `prev.${program.code}.step${index}.detail`,
    })),
    expected: {
      ...program.expected,
      statementKey: `prev.${program.code}.expected`,
      measureKey: `prev.${program.code}.measure`,
    },
    observed: parts?.observed,
  };
}

function crosses(value: number, op: NonNullable<PreventionProgram["op"]>, against: number): boolean {
  switch (op) {
    case "gt":
      return value > against;
    case "gte":
      return value >= against;
    case "lt":
      return value < against;
    case "lte":
      return value <= against;
  }
}

function matchesDiagnosis(program: PreventionProgram, labels: string[]): boolean {
  if (!program.diagnosisMatch) return true;
  return labels.some((label) => program.diagnosisMatch!.test(label));
}

/** BMI to one decimal, or undefined when either measurement is missing. */
export function bodyMassIndex(heightCm?: number, weightKg?: number): number | undefined {
  if (!heightCm || !weightKg || heightCm <= 0) return undefined;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/**
 * Matches a patient's verified state against the prevention catalog.
 *
 * Deterministic and side-effect free: the same snapshot always produces the
 * same plan, which is what makes a plan reproducible months later when someone
 * asks why the patient was told to do this.
 */
export function buildPreventionPlan(snapshot: PreventionSnapshot): PreventionPlan {
  const suggestions: PreventionSuggestion[] = [];
  const missingData = new Set<string>();

  for (const program of PREVENTION_CATALOG) {
    if (!matchesDiagnosis(program, snapshot.diagnosisLabels)) continue;

    switch (program.kind) {
      case "lab_threshold": {
        const value = program.field ? snapshot.labValues[program.field] : undefined;
        if (value === undefined) {
          // The program cannot fire without the value, but the gap itself is
          // worth surfacing: it is the reason the patient sees less advice.
          if (program.field) missingData.add(program.field);
          continue;
        }
        if (!program.op || program.value === undefined) continue;
        if (!crosses(value, program.op, program.value)) continue;
        suggestions.push(
          toSuggestion(program, {
            value,
            observed: {
              field: program.field!,
              label: fieldLabel(program.field!),
              value,
              unit: snapshot.labUnits?.[program.field!],
            },
          })
        );
        break;
      }

      case "lab_missing": {
        const value = program.field ? snapshot.labValues[program.field] : undefined;
        if (value !== undefined) continue;
        if (program.field) missingData.add(program.field);
        suggestions.push(toSuggestion(program));
        break;
      }

      case "smoking": {
        if (snapshot.smokingStatus !== "current") continue;
        suggestions.push(toSuggestion(program));
        break;
      }

      case "bmi": {
        const bmi = bodyMassIndex(snapshot.heightCm, snapshot.weightKg);
        if (bmi === undefined) {
          // Not a lab field, but the console labels it from the same dictionary.
          missingData.add("heightWeight");
          continue;
        }
        if (!program.op || program.value === undefined) continue;
        if (!crosses(bmi, program.op, program.value)) continue;
        suggestions.push(toSuggestion(program, { value: bmi }));
        break;
      }

      case "diagnosis": {
        // Reaching here means the diagnosis gate already matched.
        suggestions.push(toSuggestion(program));
        break;
      }
    }
  }

  const weightOf = new Map(PREVENTION_CATALOG.map((p) => [p.code, p.weight]));
  suggestions.sort((a, b) => (weightOf.get(b.code) ?? 0) - (weightOf.get(a.code) ?? 0));

  return {
    suggestions,
    missingData: [...missingData],
    preventionSetVersion: PREVENTION_SET_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
