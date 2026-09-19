import { CHAIN_CATALOG, CHAIN_SET_VERSION, type ChainLink, type ChainStage } from "./chain-catalog";
import { fieldLabel } from "../ai-analysis/rule-catalog";

/**
 * What the engine may look at. Deliberately the same verified-only shape the
 * clinical rules and the prevention engine take: an AI-extracted value a doctor
 * has not approved is not a fact, and must not put a patient on a disease chain.
 */
export interface ChainSnapshot {
  diagnosisLabels: string[];
  labValues: Record<string, number | undefined>;
  labUnits?: Record<string, string | undefined>;
}

export interface ChainObservation {
  field: string;
  label: string;
  value: number;
  unit?: string;
}

export interface MatchedChain {
  code: string;
  from: string;
  /** Message key for `from`. The English above stays as the fallback. */
  fromKey: string;
  to: string;
  toKey: string;
  organ: string;
  stage: ChainStage;
  mechanism: string;
  mechanismKey: string;
  /** Why this patient is on this chain, quoting what was read. */
  because: string;
  /**
   * The key and values behind `because`. `from` and `to` arrive as keys, not
   * as text: the console translates them first and then substitutes, so the
   * sentence is Uzbek all the way through rather than Uzbek around English.
   */
  becauseKey: string;
  becauseVars: Record<string, string | number>;
  /** The reading that promoted this link, when one did. */
  observed?: ChainObservation;
  /** Field name of the reading that would settle the stage, when it is not on file. */
  missingMarker?: string;
}

export interface ChainMap {
  chains: MatchedChain[];
  /** Readings that would sharpen the map if they were on file. */
  missingData: string[];
  chainSetVersion: string;
  generatedAt: string;
}

function crosses(value: number, op: NonNullable<ChainLink["marker"]>["op"], against: number): boolean {
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

const STAGE_RANK: Record<ChainStage, number> = { established: 3, early: 2, risk: 1 };

/**
 * Matches a patient's verified state against the chain catalog.
 *
 * Deterministic and side-effect free: the same snapshot always produces the
 * same map, which is what lets a doctor ask months later why this patient was
 * shown this chain and get the same answer.
 */
export function buildChainMap(snapshot: ChainSnapshot): ChainMap {
  const chains: MatchedChain[] = [];
  const missingData = new Set<string>();
  const labels = snapshot.diagnosisLabels;

  for (const link of CHAIN_CATALOG) {
    if (!labels.some((label) => link.diagnosisMatch.test(label))) continue;
    if (link.alsoRequires && !labels.some((label) => link.alsoRequires!.test(label))) continue;

    // The destination already being on the record outranks any marker: this is
    // no longer a risk to head off, it is a condition to manage.
    const established = link.establishedMatch && labels.some((label) => link.establishedMatch!.test(label));

    let stage: ChainStage = established ? "established" : "risk";
    let observed: ChainObservation | undefined;
    let missingMarker: string | undefined;

    if (link.marker) {
      const value = snapshot.labValues[link.marker.field];
      if (value === undefined) {
        // The gap itself is worth surfacing: it is the reason the stage below
        // may read lower than the patient actually is. Recorded as the field
        // name, so the console can label it in the reader's language.
        missingData.add(link.marker.field);
        missingMarker = link.marker.field;
      } else {
        observed = {
          field: link.marker.field,
          label: fieldLabel(link.marker.field),
          value,
          unit: snapshot.labUnits?.[link.marker.field],
        };
        if (!established && crosses(value, link.marker.op, link.marker.value)) stage = "early";
      }
    }

    chains.push({
      code: link.code,
      from: link.from,
      fromKey: `chain.${link.code}.from`,
      to: link.to,
      toKey: `chain.${link.code}.to`,
      organ: link.organ,
      stage,
      mechanism: link.mechanism,
      mechanismKey: `chain.${link.code}.mechanism`,
      because: becauseFor(stage, link, observed, missingMarker),
      ...becauseKeyFor(stage, link, observed, missingMarker),
      observed,
      missingMarker,
    });
  }

  // Furthest along first, then by catalog weight: what has already happened to
  // this patient outranks what might.
  const weightOf = (code: string) => CHAIN_CATALOG.find((l) => l.code === code)?.weight ?? 0;
  chains.sort((a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage] || weightOf(b.code) - weightOf(a.code));

  return {
    chains,
    missingData: [...missingData],
    chainSetVersion: CHAIN_SET_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * The same sentence as `becauseFor`, as a key and its values. Kept beside it so
 * the two cannot drift: a branch added to one is obviously missing from the
 * other.
 */
function becauseKeyFor(
  stage: ChainStage,
  link: ChainLink,
  observed?: ChainObservation,
  missingMarker?: string
): { becauseKey: string; becauseVars: Record<string, string | number> } {
  const vars: Record<string, string | number> = { fromKey: `chain.${link.code}.from`, toKey: `chain.${link.code}.to` };
  if (stage === "established") return { becauseKey: "chain.because.established", becauseVars: vars };
  if (observed) {
    Object.assign(vars, { field: observed.field, value: observed.value, unit: observed.unit ?? "" });
    return {
      becauseKey: stage === "early" ? "chain.because.early" : "chain.because.stable",
      becauseVars: vars,
    };
  }
  if (missingMarker) {
    return { becauseKey: "chain.because.missing", becauseVars: { ...vars, field: missingMarker } };
  }
  return { becauseKey: "chain.because.plain", becauseVars: vars };
}

function becauseFor(
  stage: ChainStage,
  link: ChainLink,
  observed?: ChainObservation,
  missingMarker?: string
): string {
  if (stage === "established") {
    return `${link.to} is already recorded on this patient's chart.`;
  }
  if (stage === "early" && observed) {
    const unit = observed.unit ? ` ${observed.unit}` : "";
    return `${link.from} is on the chart and the ${observed.label} reads ${observed.value}${unit}.`;
  }
  if (observed) {
    const unit = observed.unit ? ` ${observed.unit}` : "";
    return `${link.from} is on the chart; the ${observed.label} reads ${observed.value}${unit} and has not crossed the catalog marker.`;
  }
  if (missingMarker) {
    return `${link.from} is on the chart, and the ${fieldLabel(missingMarker)} that would show whether this has started is not on file.`;
  }
  return `${link.from} is on the chart.`;
}
