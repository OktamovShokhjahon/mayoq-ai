import type { ChainStage } from "./chain-catalog";
import type { MatchedChain } from "./chain-engine";
import type { ChainGuidance } from "./chain.service";

/**
 * Reviewed, hand-authored guidance used when the model cannot be reached.
 *
 * A parser, not a model: the wording below never changes and is written once
 * per stage, so it can say only what is true of every chain at that stage. It
 * is labelled `catalog_fallback` everywhere it surfaces — a doctor must never
 * have to wonder which of the two produced the advice they are reading.
 *
 * Same hard boundary as the catalog: no medicine, no dose, no numeric target,
 * and nothing that tells anyone to start, stop or change a treatment.
 */
const BY_STAGE: Record<ChainStage, Omit<ChainGuidance, "code" | "explanation" | "explanationKey" | "doThisKeys" | "avoidThisKeys" | "seeDoctorIfKeys">> = {
  established: {
    doThis: [
      "Keep to the monitoring schedule already agreed for this condition.",
      "Bring readings taken between visits to each appointment.",
      "Review this chain at every scheduled follow-up.",
    ],
    avoidThis: [
      "Do not let a scheduled check slip without rebooking it.",
      "Do not treat a stable reading as a reason to stop monitoring.",
    ],
    seeDoctorIf: [
      "New symptoms appear, or existing ones get noticeably worse.",
      "A reading moves sharply away from its usual range.",
    ],
  },
  early: {
    doThis: [
      "Book the follow-up check that tracks this chain.",
      "Keep daily routine steady: regular meals, movement and sleep.",
      "Record readings between visits so the direction of travel is visible.",
    ],
    avoidThis: [
      "Do not wait for symptoms before the next check.",
      "Do not smoke; it accelerates every chain on this list.",
    ],
    seeDoctorIf: [
      "Symptoms connected to this organ appear for the first time.",
      "Readings keep moving in the same direction between visits.",
    ],
  },
  risk: {
    doThis: [
      "Keep the starting condition well controlled as already planned.",
      "Attend the routine screening for this complication.",
    ],
    avoidThis: [
      "Do not skip screening because there are no symptoms.",
      "Do not smoke; it accelerates every chain on this list.",
    ],
    seeDoctorIf: ["Any new symptom appears that you have not had before."],
  },
};

/** `chain.stage.early.do.1` — one key per line above, derived from its position. */
function keysFor(stage: ChainStage, list: "do" | "avoid" | "see", items: string[]): string[] {
  return items.map((_, index) => `chain.stage.${stage}.${list}.${index}`);
}

/** Stage-level guidance for each matched link. Deterministic and repeatable. */
export function fallbackGuidance(chains: MatchedChain[]): ChainGuidance[] {
  return chains.map((chain) => {
    const stage = BY_STAGE[chain.stage];
    return {
      code: chain.code,
      // The reviewed mechanism stands in for the model's explanation: it is the
      // same fact, just not reworded for this reader.
      explanation: chain.mechanism,
      explanationKey: chain.mechanismKey,
      ...stage,
      doThisKeys: keysFor(chain.stage, "do", stage.doThis),
      avoidThisKeys: keysFor(chain.stage, "avoid", stage.avoidThis),
      seeDoctorIfKeys: keysFor(chain.stage, "see", stage.seeDoctorIf),
    };
  });
}
