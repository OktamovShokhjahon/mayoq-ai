import crypto from "node:crypto";
import { z } from "zod";
import { callGeminiStructured } from "../ai-analysis/gemini.client";
import { languageName } from "../ai-analysis/language";
import type { PreventionPlan } from "./prevention-engine";

const PROMPT_VERSION = "prevention-wording@1";
const CACHE_TTL_MS = 60 * 60 * 1000;

const WORDING_SCHEMA = z.object({
  intro: z.string(),
  items: z.array(z.object({ code: z.string(), text: z.string() })),
});

export interface PreventionWording {
  intro: string;
  items: Array<{ code: string; text: string }>;
  modelId: string;
  promptVersion: string;
}

// The same plan is fetched on every dashboard visit; the wording only needs to
// be regenerated when the plan underneath it changes. This also keeps free-tier
// requests down.
const cache = new Map<string, { at: number; wording: PreventionWording }>();

/**
 * Rewords the deterministic prevention plan in friendly language. The catalog
 * decides what is suggested and why; the model may not add, drop or change a
 * suggestion, so the wording can only ever restate what the rules produced.
 * Returns undefined when the model is unavailable and the plain plan stands.
 */
export async function explainPreventionPlan(plan: PreventionPlan, tenantId?: string, language?: string): Promise<PreventionWording | undefined> {
  if (plan.suggestions.length === 0) return undefined;

  const source = plan.suggestions.map((s) => ({
    code: s.code,
    title: s.title,
    prevents: s.prevents,
    because: s.because,
    routine: s.routine,
  }));
  const key = crypto.createHash("sha256").update(JSON.stringify(source) + (language ?? "en")).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.wording;

  const result = await callGeminiStructured({
    systemPrompt:
      "You reword lifestyle prevention suggestions for a patient in warm, plain language, written in " + languageName(language) + ". " +
      "Write one short intro sentence, then one item per input suggestion, in the same order, keeping each item's code. " +
      "Each item is 40 words at most. Use ONLY the content provided: never add a number, target, medicine, diagnosis or a suggestion that is not in the input, and never drop one. " +
      "Do not mention medication. " +
      'Return strict JSON: {"intro": string, "items": [{"code": string, "text": string}]}.',
    userPrompt: JSON.stringify(source),
    schema: WORDING_SCHEMA,
    tenantId,
    promptVersion: PROMPT_VERSION,
    temperature: 0.3,
    language,
  });
  if (!result.ok || !result.data) return undefined;

  // Anything the model returned for a code that is not in the plan is dropped.
  const known = new Set(plan.suggestions.map((s) => s.code));
  const wording: PreventionWording = {
    intro: result.data.intro,
    items: result.data.items.filter((item) => known.has(item.code)),
    modelId: result.modelId,
    promptVersion: PROMPT_VERSION,
  };
  cache.set(key, { at: Date.now(), wording });
  return wording;
}
