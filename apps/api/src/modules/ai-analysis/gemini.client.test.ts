import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

const schema = z.object({ narrative: z.string(), confidence: z.enum(["limited", "moderate", "high"]) });
const call = (mod: typeof import("./gemini.client"), tenantId = "t1") =>
  mod.callGeminiStructured({
    systemPrompt: "s",
    userPrompt: "u",
    schema,
    promptVersion: "treatment-scenario-narrative@1",
    tenantId,
  });

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./gemini.client");
}

describe("callGeminiStructured", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails honestly without a key when the demo fallback is off", async () => {
    const mod = await load({ GEMINI_API_KEY: "", DEMO_AI_FALLBACK: "false" });
    const result = await call(mod);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("AI_UNAVAILABLE");
  });

  it("serves a labelled pre-recorded answer when the demo fallback is on", async () => {
    const mod = await load({ GEMINI_API_KEY: "", DEMO_AI_FALLBACK: "true" });
    const result = await call(mod);
    expect(result.ok).toBe(true);
    expect(result.modelId).toContain("demo-fallback");
    expect(result.data?.narrative).toContain("Demo");
  });

  it("does not invent an answer for a task with no recorded response", async () => {
    const mod = await load({ GEMINI_API_KEY: "", DEMO_AI_FALLBACK: "true" });
    const result = await mod.callGeminiStructured({
      systemPrompt: "s",
      userPrompt: "u",
      schema,
      promptVersion: "document-understanding@2",
    });
    expect(result.ok).toBe(false);
  });

  it("limits one clinic without limiting another", async () => {
    const mod = await load({ GEMINI_API_KEY: "", AI_TENANT_PER_MINUTE: "2", AI_GLOBAL_PER_MINUTE: "50" });
    const errors: (string | undefined)[] = [];
    for (let i = 0; i < 3; i += 1) errors.push((await call(mod, "busy")).error);
    expect(errors[2]).toContain("AI_RATE_LIMITED");
    expect((await call(mod, "quiet")).error).toContain("AI_UNAVAILABLE");
  });
});
