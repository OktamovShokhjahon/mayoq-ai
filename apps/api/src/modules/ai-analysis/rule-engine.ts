import type { OrganSignal } from "./treatment-scenario.model";
import { RULE_CATALOG, RULE_SET_VERSION, fieldLabel, type RuleDefinition, type ThresholdCheck } from "./rule-catalog";
import type { RiskColor } from "../../shared/types";

export interface PatientSnapshot {
  diagnosisLabels: string[];
  /** Medications in the plan being analyzed. */
  medicationNames: string[];
  /** Everything else the patient is already taking, for interaction checks. */
  existingMedicationNames?: string[];
  /** Recorded allergy substances. Only verified allergies belong here. */
  allergySubstances?: string[];
  labValues: Record<string, number | undefined>;
  labUnits?: Record<string, string | undefined>;
  evidenceRecordIds: string[];
}

const SEVERITY_TO_LEVEL: Record<RiskColor, "low" | "moderate" | "high"> = {
  green: "low",
  yellow: "moderate",
  red: "high",
};

const COLOR_RANK: Record<RiskColor, number> = { green: 0, yellow: 1, red: 2 };

export interface RuleEngineResult {
  overallRisk: RiskColor;
  signals: OrganSignal[];
  affectedOrgans: string[];
  missingData: string[];
  ruleSetVersion: string;
}

function crosses(value: number, check: ThresholdCheck): boolean {
  switch (check.op) {
    case "lt":
      return value < check.value;
    case "lte":
      return value <= check.value;
    case "gt":
      return value > check.value;
    case "gte":
      return value >= check.value;
  }
}

function matchesAny(patterns: RegExp, names: string[]): boolean {
  return names.some((name) => patterns.test(name));
}

/**
 * Which part of the rule fired, and why. Threshold results beat the generic
 * template: a doctor who has just recorded an eGFR should never be told the
 * value is missing, and a value that crosses a line should be quoted back.
 */
function evaluateRule(
  rule: RuleDefinition,
  snapshot: PatientSnapshot,
  allMedications: string[]
): {
  severity: RiskColor;
  explanation: string;
  explanationKey: string;
  explanationVars?: Record<string, string | number>;
  missingForRule: string[];
  observed: OrganSignal["observed"];
} | null {
  const missingForRule = rule.requiredFields.filter((field) => snapshot.labValues[field] === undefined);

  const observed: OrganSignal["observed"] = [];
  for (const field of rule.requiredFields) {
    const value = snapshot.labValues[field];
    if (value !== undefined) {
      observed.push({ field, label: fieldLabel(field), value, unit: snapshot.labUnits?.[field] });
    }
  }

  // Thresholds can read fields outside requiredFields (an ACE-inhibitor rule
  // reacts to eGFR when it happens to be on file) — record those too.
  let worst: { severity: RiskColor; explanation: string; key: string; vars: Record<string, string | number> } | null = null;
  for (const check of rule.thresholds ?? []) {
    const value = snapshot.labValues[check.field];
    if (value === undefined) continue;
    if (!observed.some((entry) => entry.field === check.field)) {
      observed.push({
        field: check.field,
        label: fieldLabel(check.field),
        value,
        unit: snapshot.labUnits?.[check.field],
      });
    }
    if (!crosses(value, check)) continue;
    const explanation = check.explanation.replace("{value}", String(value));
    if (!worst || COLOR_RANK[check.severity] > COLOR_RANK[worst.severity]) {
      // The key travels with the value it quotes, so the same sentence can be
      // rebuilt in any language without re-running the rule.
      worst = { severity: check.severity, explanation, key: `rule.${rule.code}.${check.key}`, vars: { value } };
    }
  }

  if (worst) {
    // A crossed threshold is the finding, but missing companion data still
    // counts as missing: the doctor is owed both facts.
    return {
      severity: worst.severity,
      explanation: worst.explanation,
      explanationKey: worst.key,
      explanationVars: worst.vars,
      missingForRule,
      observed,
    };
  }

  if (missingForRule.length > 0) {
    return {
      severity: rule.missingDataSeverity,
      explanation: rule.missingExplanation,
      explanationKey: `rule.${rule.code}.missing`,
      missingForRule,
      observed,
    };
  }

  return {
    severity: rule.baselineSeverity,
    explanation: rule.satisfiedExplanation,
    explanationKey: `rule.${rule.code}.satisfied`,
    missingForRule: [],
    observed,
  };
}

/** Does this rule apply to the plan at all? */
function ruleApplies(rule: RuleDefinition, snapshot: PatientSnapshot, allMedications: string[]): boolean {
  if (rule.diagnosisMatch && !matchesAny(rule.diagnosisMatch, snapshot.diagnosisLabels)) return false;

  switch (rule.kind) {
    case "condition_medication":
      // Only the proposed plan triggers a condition rule; an interaction with a
      // medication the patient already takes is what the other kinds are for.
      return matchesAny(rule.medicationMatch, snapshot.medicationNames);

    case "medication_medication": {
      const first = matchesAny(rule.medicationMatch, allMedications);
      const second = rule.secondMedicationMatch ? matchesAny(rule.secondMedicationMatch, allMedications) : true;
      const third = rule.thirdMedicationMatch ? matchesAny(rule.thirdMedicationMatch, allMedications) : true;
      // At least one of the interacting drugs has to be part of what is being
      // proposed, otherwise this is a pre-existing combination, not this plan's.
      const touchesPlan =
        matchesAny(rule.medicationMatch, snapshot.medicationNames) ||
        (rule.secondMedicationMatch ? matchesAny(rule.secondMedicationMatch, snapshot.medicationNames) : false) ||
        (rule.thirdMedicationMatch ? matchesAny(rule.thirdMedicationMatch, snapshot.medicationNames) : false);
      return first && second && third && touchesPlan;
    }

    case "duplicate_therapy": {
      const matches = allMedications.filter((name) => rule.medicationMatch.test(name));
      const distinct = new Set(matches.map((name) => name.toLowerCase().trim()));
      return distinct.size > 1 && matchesAny(rule.medicationMatch, snapshot.medicationNames);
    }

    case "allergy_conflict": {
      const allergies = snapshot.allergySubstances ?? [];
      if (allergies.length === 0) return false;
      if (rule.allergyMatch) {
        return matchesAny(rule.allergyMatch, allergies) && matchesAny(rule.medicationMatch, snapshot.medicationNames);
      }
      // No pattern: compare the actual strings, so a plan containing a drug the
      // patient is recorded as allergic to is caught by name.
      return snapshot.medicationNames.some((medication) =>
        allergies.some((substance) => {
          const a = medication.toLowerCase().trim();
          const b = substance.toLowerCase().trim();
          return a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a));
        })
      );
    }
  }
}

export function runClinicalRules(snapshot: PatientSnapshot): RuleEngineResult {
  const signals: OrganSignal[] = [];
  const affectedOrgans = new Set<string>();
  const missingData = new Set<string>();
  let overallRisk: RiskColor = "green";

  const allMedications = [...snapshot.medicationNames, ...(snapshot.existingMedicationNames ?? [])];

  for (const rule of RULE_CATALOG) {
    if (!ruleApplies(rule, snapshot, allMedications)) continue;

    const outcome = evaluateRule(rule, snapshot, allMedications);
    if (!outcome) continue;

    outcome.missingForRule.forEach((field) => missingData.add(field));
    rule.organsAffected.forEach((organ) => affectedOrgans.add(organ));

    for (const organ of rule.organsAffected) {
      signals.push({
        type: "organ_risk",
        organ,
        severity: SEVERITY_TO_LEVEL[outcome.severity],
        color: outcome.severity,
        explanation: outcome.explanation,
        explanationKey: outcome.explanationKey,
        explanationVars: outcome.explanationVars,
        evidenceRecordIds: snapshot.evidenceRecordIds,
        missingData: outcome.missingForRule,
        observed: outcome.observed,
        monitoring: rule.monitoring,
        monitoringKey: rule.monitoring ? `rule.${rule.code}.monitoring` : undefined,
        ruleCode: rule.code,
      });
    }

    if (COLOR_RANK[outcome.severity] > COLOR_RANK[overallRisk]) {
      overallRisk = outcome.severity;
    }
  }

  return {
    overallRisk,
    signals,
    affectedOrgans: [...affectedOrgans],
    missingData: [...missingData],
    ruleSetVersion: RULE_SET_VERSION,
  };
}
