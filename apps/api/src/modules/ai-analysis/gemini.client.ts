import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { DEMO_MODEL_ID, demoResponseFor } from "./demo-fallback";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * One attempt, and the whole chain. A panel that waits a minute for advice has
 * already failed the doctor reading it, and under `tsx watch` a request that
 * outlives a reload comes back to the browser as a refused connection. When
 * the budget runs out the caller falls back to its deterministic output.
 */
const REQUEST_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 32_000;
// 503 is handled by moving to the next model, so it is not retried in place.
const RETRYABLE_STATUS = new Set([500]);
/**
 * A model that is out of its daily allowance, retired, or overloaded will not
 * recover inside one request. Rather than fail the panel, move on to the next
 * model on the list: 404 is a retired model, 429 an exhausted allowance.
 */
const FAILOVER_STATUS = new Set([404, 429, 503]);

/**
 * `thinkingBudget: 0` is how the 2.x and early-3.x models are told to skip
 * reasoning tokens. From 3.5 onward the field is rejected outright with
 * 400 INVALID_ARGUMENT, which failed every structured call on a current model.
 * Older models still get the saving; newer ones simply go without.
 */
const SUPPORTS_THINKING_BUDGET_ZERO = /gemini-(1.5|2.d|3.0|3.1)/;

/** The primary model first, then the configured stand-ins, without repeats. */
function modelChain(): string[] {
  return [...new Set([env.geminiModel, ...env.geminiFallbackModels])].filter(Boolean);
}

export const NARRATIVE_SCHEMA = z.object({
  narrative: z.string(),
  confidence: z.enum(["limited", "moderate", "high"]),
});

export type NarrativeOutput = z.infer<typeof NARRATIVE_SCHEMA>;

export interface StructuredCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  modelId: string;
  responseId?: string;
  latencyMs: number;
  tokenUsage?: { prompt: number; completion: number };
}

/** A file the model reads directly, e.g. a scanned page or a phone photo. */
export interface InlineMedia {
  mimeType: string;
  data: Buffer;
}

interface GeminiResponse {
  responseId?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

export function isAiConfigured(): boolean {
  return Boolean(env.geminiApiKey);
}

async function postWithRetry(url: string, body: string, deadline = Infinity): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const left = Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now());
    if (left <= 0) throw new Error("AI_TIMEOUT: out of time before the request could be sent");
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body,
      signal: AbortSignal.timeout(left),
    });
    if (!RETRYABLE_STATUS.has(response.status)) return response;
    // A transient overload usually clears within a second or two.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return response as Response;
}

/** Per-model generation settings, so one unsupported field cannot fail a call. */
function generationConfig(modelId: string, temperature: number): Record<string, unknown> {
  const config: Record<string, unknown> = { temperature, responseMimeType: "application/json" };
  // Extraction and explanation are bounded tasks; reasoning tokens only add
  // latency against the free-tier quota, where the model accepts being told so.
  if (SUPPORTS_THINKING_BUDGET_ZERO.test(modelId)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

/**
 * Calls Gemini for a strictly-scoped task and validates the JSON response
 * against the given Zod schema. Never called from the browser; the backend is
 * the only caller. On any failure the caller must fall back to a deterministic
 * "AI unavailable" state rather than fabricate an answer.
 */
async function callGeminiLive<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
  media?: InlineMedia[];
}): Promise<StructuredCallResult<T>> {
  const start = Date.now();
  const chain = modelChain();

  if (!env.geminiApiKey) {
    return {
      ok: false,
      error: "AI_UNAVAILABLE: GEMINI_API_KEY not configured",
      modelId: chain[0],
      latencyMs: Date.now() - start,
    };
  }

  const parts: Array<Record<string, unknown>> = [{ text: params.userPrompt }];
  for (const item of params.media ?? []) {
    parts.push({ inlineData: { mimeType: item.mimeType, data: item.data.toString("base64") } });
  }

  let lastError = "Unknown AI error";
  const deadline = start + TOTAL_BUDGET_MS;

  for (const modelId of chain) {
    if (Date.now() >= deadline) {
      lastError = `AI_TIMEOUT: no model answered within ${TOTAL_BUDGET_MS}ms`;
      break;
    }
    try {
      const response = await postWithRetry(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(modelId)}:generateContent`,
        JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: generationConfig(modelId, params.temperature ?? 0.1),
        }),
        deadline
      );

      const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) {
        const message = `Gemini ${response.status}: ${payload.error?.message ?? response.statusText}`;
        // Out of quota, retired or overloaded: the next model may well answer.
        if (FAILOVER_STATUS.has(response.status)) {
          lastError = message;
          logger.warn({ modelId, status: response.status }, "Gemini model unavailable, trying next");
          continue;
        }
        throw new Error(message);
      }
      if (payload.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the request: ${payload.promptFeedback.blockReason}`);
      }

      const candidate = payload.candidates?.[0];
      const raw = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (!raw) throw new Error(`Gemini returned no content (${candidate?.finishReason ?? "unknown"})`);

      const validated = params.schema.parse(JSON.parse(raw));

      return {
        ok: true,
        data: validated,
        modelId,
        responseId: payload.responseId,
        latencyMs: Date.now() - start,
        tokenUsage: {
          prompt: payload.usageMetadata?.promptTokenCount ?? 0,
          completion: payload.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown AI error";
      logger.error({ err, modelId, promptVersion: params.promptVersion }, "Gemini structured call failed");
      // A timeout says nothing about the prompt, so a faster model still has a
      // chance if the budget allows. A bad prompt, a blocked request or
      // malformed JSON is the call's own problem: another model fails the same
      // way, so stop rather than spend quota proving it.
      const timedOut = /timeout|aborted|AI_TIMEOUT/i.test(lastError);
      if (!timedOut) break;
    }
  }

  return { ok: false, error: lastError, modelId: chain[0], latencyMs: Date.now() - start };
}

/**
 * Free-tier quota is per key, not per clinic, so one busy clinic could starve
 * the rest. Each clinic gets its own per-minute allowance and the key gets a
 * global one just under the provider's limit.
 */
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function withinLimit(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Returns false, without recording a hit, when either allowance is spent. */
function reserveQuota(tenantId?: string): boolean {
  const now = Date.now();
  const count = (key: string) => (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS).length;
  if (count("global") >= env.aiGlobalPerMinute) return false;
  if (tenantId && count("tenant:" + tenantId) >= env.aiTenantPerMinute) return false;
  withinLimit("global", env.aiGlobalPerMinute);
  if (tenantId) withinLimit("tenant:" + tenantId, env.aiTenantPerMinute);
  return true;
}

/**
 * The one entry point for every model call. Order: quota check, live Gemini,
 * then — only when DEMO_AI_FALLBACK is on — a labelled pre-recorded answer.
 * With the fallback off, a failure stays a failure and callers fall back to
 * deterministic output.
 */
export async function callGeminiStructured<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  promptVersion: string;
  temperature?: number;
  media?: InlineMedia[];
  /** The clinic making the request, for its per-minute allowance. */
  tenantId?: string;
  /**
   * The interface language the page asked for. Only the pre-recorded fallback
   * reads it here — a live call carries its own instruction in the prompt —
   * but a canned answer has no prompt to carry one, so it needs telling.
   */
  language?: string;
}): Promise<StructuredCallResult<T>> {
  const start = Date.now();
  const live: StructuredCallResult<T> = reserveQuota(params.tenantId)
    ? await callGeminiLive(params)
    : {
        ok: false,
        error: "AI_RATE_LIMITED: too many AI requests this minute. Wait a moment and try again.",
        modelId: env.geminiModel,
        latencyMs: Date.now() - start,
      };
  if (live.ok || !env.demoAiFallback) return live;

  const canned = demoResponseFor(params.promptVersion, params.language);
  const parsed = canned === undefined ? undefined : params.schema.safeParse(canned);
  if (!parsed?.success) return live;

  logger.warn({ promptVersion: params.promptVersion, error: live.error }, "Serving demo fallback answer");
  return { ok: true, data: parsed.data, modelId: DEMO_MODEL_ID, latencyMs: Date.now() - start };
}

export interface GroundedResult {
  ok: boolean;
  text?: string;
  /** Pages the search actually returned, so every claim can be traced. */
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  error?: string;
  modelId: string;
  latencyMs: number;
}

interface GroundedResponse extends GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
}

/**
 * Asks Gemini with Google Search grounding, for literature and guideline
 * lookups. Search grounding cannot be combined with a JSON response schema, so
 * this returns prose plus the sources the search used, and a caller that needs
 * structure runs a second, schema-bound call over the text.
 *
 * Callers must send only de-identified content: this query leaves the system.
 */
export async function callGeminiGrounded(params: {
  systemPrompt: string;
  userPrompt: string;
  tenantId?: string;
}): Promise<GroundedResult> {
  const start = Date.now();
  const modelId = env.geminiModel;
  const fail = (error: string): GroundedResult => ({
    ok: false,
    sources: [],
    searchQueries: [],
    error,
    modelId,
    latencyMs: Date.now() - start,
  });

  if (!env.geminiApiKey) return fail("AI_UNAVAILABLE: GEMINI_API_KEY not configured");
  if (!reserveQuota(params.tenantId)) return fail("AI_RATE_LIMITED: too many AI requests this minute.");

  try {
    const response = await postWithRetry(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(modelId)}:generateContent`,
      JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      })
    );
    const payload = (await response.json().catch(() => ({}))) as GroundedResponse;
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${payload.error?.message ?? response.statusText}`);

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!text) throw new Error(`Gemini returned no content (${candidate?.finishReason ?? "unknown"})`);

    const seen = new Set<string>();
    const sources: Array<{ title: string; url: string }> = [];
    for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
      const url = chunk.web?.uri;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: chunk.web?.title ?? url, url });
    }

    return {
      ok: true,
      text,
      sources,
      searchQueries: candidate?.groundingMetadata?.webSearchQueries ?? [],
      modelId,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    logger.error({ err }, "Gemini grounded call failed");
    return fail(err instanceof Error ? err.message : "Unknown AI error");
  }
}
