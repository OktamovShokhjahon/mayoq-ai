import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/twinrx"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  // Never hard-code a key here: a committed key leaks and then gets revoked,
  // which is indistinguishable from "the AI is broken". Set it in .env.
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  // The free tier caps requests per day per model, so one model running dry
  // must not take every AI panel down with it. Tried in order after the
  // primary, on an exhausted, retired or overloaded model only. Ordered by
  // speed, not quality: a stand-in is already a degraded answer, and a slow
  // one just burns the time budget before the next model gets a turn.
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.1-flash-lite,gemini-3.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  aiTenantPerMinute: Number(process.env.AI_TENANT_PER_MINUTE ?? 8),
  aiGlobalPerMinute: Number(process.env.AI_GLOBAL_PER_MINUTE ?? 12),
  demoAiFallback: process.env.DEMO_AI_FALLBACK === "true",
  billingProvider: process.env.BILLING_PROVIDER ?? "mock",
  billingWebhookSecret: process.env.BILLING_WEBHOOK_SECRET ?? "dev_webhook_secret",
  demoTrialDays: Number(process.env.DEMO_TRIAL_DAYS ?? 7),
};
