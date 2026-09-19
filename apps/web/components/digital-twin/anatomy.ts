import type { RiskColor } from "./types";
import type { MessageKey } from "@/lib/locales/uz";

export type Sex = "male" | "female" | "neutral";

/**
 * Maps the recorded profile value (§12.3 allows male, female, other, unknown)
 * onto a twin. Anything not recorded as male or female gets a neutral body and
 * no sex-specific organs — the twin must not assert anatomy the record does not
 * contain.
 */
export function twinSex(recorded?: string | null): Sex {
  return recorded === "male" || recorded === "female" ? recorded : "neutral";
}

/**
 * Anatomical registry. The 3D scene, the 2D fallback diagram and the organ
 * readout all read from here, so an organ added once appears consistently in
 * every view.
 *
 * Model space: feet at y=0, top of head near y=1.75, +z anterior, +x the
 * patient's left. Laterality matters — in an anterior view the heart sits to
 * the patient's left and the liver in the right upper quadrant.
 */
export interface OrganDef {
  /** Signal key as emitted by the analysis pipeline. */
  key: string;
  label: string;
  /** System grouping shown in the readout. */
  system: string;
  /** Present only for this sex; omitted means every body. */
  sex?: "male" | "female";
  /** Which side of the stage its leader label hangs on. */
  labelSide: "left" | "right";
  /** One or more sites — lungs, kidneys, eyes, ovaries and testes are paired. */
  sites: Array<{
    position: [number, number, number];
    /** Bounding half-extents, used for the halo and for hit padding. */
    radius: [number, number, number];
    rotation?: [number, number, number];
  }>;
  /** Anchor in the 2D diagram viewBox (0 0 200 420). */
  diagramAt: [number, number];
}

export const ORGANS: OrganDef[] = [
  {
    key: "nervous_system",
    label: "Nervous system",
    system: "Neurological",
    labelSide: "left",
    sites: [{ position: [0, 1.695, -0.012], radius: [0.07, 0.062, 0.072] }],
    diagramAt: [100, 22],
  },
  {
    key: "eyes",
    label: "Eyes",
    system: "Ophthalmic",
    labelSide: "right",
    sites: [
      { position: [-0.038, 1.648, 0.072], radius: [0.011, 0.011, 0.011] },
      { position: [0.038, 1.648, 0.072], radius: [0.011, 0.011, 0.011] },
    ],
    diagramAt: [100, 46],
  },
  {
    key: "spine",
    label: "Spine",
    system: "Skeletal",
    labelSide: "left",
    sites: [{ position: [0, 1.17, -0.062], radius: [0.022, 0.3, 0.022] }],
    diagramAt: [100, 92],
  },
  {
    key: "lungs",
    label: "Lungs",
    system: "Respiratory",
    labelSide: "left",
    sites: [
      { position: [-0.068, 1.255, -0.004], radius: [0.058, 0.115, 0.058] },
      { position: [0.068, 1.255, -0.004], radius: [0.058, 0.115, 0.058] },
    ],
    diagramAt: [82, 112],
  },
  {
    key: "heart",
    label: "Heart",
    system: "Cardiovascular",
    labelSide: "right",
    sites: [{ position: [0.035, 1.275, 0.052], radius: [0.055, 0.075, 0.05] }],
    diagramAt: [114, 110],
  },
  {
    key: "cardiovascular_system",
    label: "Cardiovascular system",
    system: "Cardiovascular",
    labelSide: "right",
    sites: [{ position: [0, 1.2, 0.02], radius: [0.038, 0.115, 0.03] }],
    diagramAt: [100, 130],
  },
  {
    key: "liver",
    label: "Liver",
    system: "Hepatic",
    labelSide: "left",
    sites: [
      { position: [-0.085, 1.135, 0.045], radius: [0.088, 0.062, 0.062] },
    ],
    diagramAt: [78, 146],
  },
  {
    key: "stomach",
    label: "Stomach",
    system: "Digestive",
    labelSide: "right",
    sites: [{ position: [0.042, 1.118, 0.034], radius: [0.05, 0.05, 0.036] }],
    diagramAt: [120, 142],
  },
  {
    key: "blood_vessels",
    label: "Blood vessels",
    system: "Vascular",
    labelSide: "left",
    sites: [{ position: [0, 1.16, -0.01], radius: [0.013, 0.145, 0.013] }],
    diagramAt: [88, 160],
  },
  {
    key: "pancreas",
    label: "Pancreas",
    system: "Endocrine",
    labelSide: "right",
    sites: [{ position: [0.012, 1.085, 0.012], radius: [0.055, 0.022, 0.026] }],
    diagramAt: [114, 158],
  },
  {
    key: "kidney",
    label: "Kidneys",
    system: "Renal",
    labelSide: "left",
    sites: [
      {
        position: [-0.088, 1.06, -0.052],
        radius: [0.031, 0.05, 0.03],
        rotation: [0, 0, 0.1],
      },
      {
        position: [0.088, 1.06, -0.052],
        radius: [0.031, 0.05, 0.03],
        rotation: [0, 0, -0.1],
      },
    ],
    diagramAt: [100, 172],
  },
  {
    key: "intestines",
    label: "Intestines",
    system: "Digestive",
    labelSide: "right",
    sites: [{ position: [0, 0.995, 0.022], radius: [0.098, 0.082, 0.05] }],
    diagramAt: [100, 188],
  },
];

/** Organs present for a given patient. */
export function organsFor(sex: Sex): OrganDef[] {
  return ORGANS.filter((organ) => !organ.sex || organ.sex === sex);
}

export const ORGAN_BY_KEY: Record<string, OrganDef> = Object.fromEntries(
  ORGANS.map((organ) => [organ.key, organ]),
);

export const ORGAN_LABELS: Record<string, string> = Object.fromEntries(
  ORGANS.map((organ) => [organ.key, organ.label]),
);

/**
 * Message keys for an organ and for a system grouping. The registry keeps the
 * English `label`/`system` as the structural name, and these resolve it into
 * whichever language the console is running in — so an organ added to the
 * registry is translated by adding two dictionary entries, not by touching
 * every view that draws it.
 */
export function organLabelKey(organKey: string): MessageKey {
  return `organ.${organKey}` as MessageKey;
}

export function systemLabelKey(system: string): MessageKey {
  return `system.${system}` as MessageKey;
}

/** Clinical state colours, matching the table in technical mission §8.7. */
export const STATE_HEX: Record<RiskColor, string> = {
  green: "#0f8a5f",
  yellow: "#b0760a",
  red: "#cf3b47",
};

/** Brighter variants for the 3D scene, which sits behind translucent skin. */
export const STATE_HEX_3D: Record<RiskColor, string> = {
  green: "#18b87c",
  yellow: "#e8a318",
  red: "#e8434f",
};

/** Colour is never the only signal: each state also carries a glyph and text. */
export const STATE_GLYPH: Record<RiskColor, string> = {
  green: "✓",
  yellow: "△",
  red: "✕",
};

/**
 * The state wording lives in the dictionaries, so this maps a colour onto its
 * message key and callers translate it. Colour is never the only signal, and
 * the text that carries the signal has to be readable in the console's
 * language.
 */
export const STATE_LABEL_KEY: Record<RiskColor, MessageKey> = {
  green: "risk.green",
  yellow: "risk.yellow",
  red: "risk.red",
};

/** Unmapped organ signals still need somewhere to render. */
export const FALLBACK_SITE: [number, number, number] = [0, 1.2, 0.06];
