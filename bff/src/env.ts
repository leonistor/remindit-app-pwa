// Env comes from the single root .env (D9), injected by the root scripts via
// `bun --env-file=../.env`. Every value has a dev-safe default so `bun test`
// and type-only consumers of the module never need configuration.

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

const bool = (raw: string | undefined, fallback: boolean): boolean =>
  raw === undefined || raw === "" ? fallback : raw === "true" || raw === "1"

export const env = {
  /** Hono (Bun.serve) port. */
  port: positiveInt(process.env.PORT, 3100),
  /**
   * Auth (/api/auth/*) brute-force window — attempts per 15 minutes per IP.
   * Env-tunable so test harnesses (many parallel in-process registrations share
   * the in-memory key "unknown") can raise it; prod keeps the default 20.
   */
  authRateLimit: positiveInt(process.env.AUTH_RATE_LIMIT, 20),
  /** PocketBase internal URL — bound to localhost, never public (D2). */
  pocketbaseUrl: process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090",
  /** PocketBase data dir, resolved from the repo root (gitignored). */
  pocketbaseDataDir: process.env.POCKETBASE_DATA_DIR ?? "bff/pb_data",
  /** Dev-only superuser credentials (migrations + MCP + admin-side tests). */
  pocketbaseAdminEmail: process.env.POCKETBASE_ADMIN_EMAIL,
  pocketbaseAdminPassword: process.env.POCKETBASE_ADMIN_PASSWORD,
  /**
   * Shared dev/demo password for every platform-seed user (`bun run seed:bff`).
   * Kept out of the committed dataset (`common/seeds/platform.json`) so the
   * reviewable JSON carries no credential-shaped strings (gitguardian). The
   * real value lives in the root .env; this fallback only covers "forgot to
   * set it" dev runs.
   */
  seedPassword: process.env.SEED_PASSWORD ?? "change-me-dev-only",
  /**
   * Session cookie: `Secure` attribute — enable in production (TLS behind the
   * reverse proxy); dev http://localhost keeps it false.
   */
  sessionCookieSecure: bool(process.env.SESSION_COOKIE_SECURE, false),
  /**
   * CORS origin allowlist (comma-separated `CORS_ORIGINS`). The frontends are
   * separate origins from the BFF (pwa 3000 / web 3200 / admin 3300 locally),
   * and prod serves them from different subdomains — so the BFF must answer
   * preflights for exactly these, never `*` (Bearer tokens + session cookies
   * ride these requests). Defaults cover local dev.
   */
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://localhost:3200,http://localhost:3300"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * AI support chat — which provider serves the assistant and which model it
   * runs (phase 1: `ollama` for local dev on pop-os.lan, or `openrouter` with
   * the dedicated key). Defaults cover a dev run against local ollama, so the
   * assistant works with zero config; switch to openrouter to compare models
   * via the ai-smoke script. See src/services/ai.ts.
   */
  aiProvider: process.env.AI_PROVIDER ?? "ollama",
  /** Model id string passed to the chosen provider (not the router). */
  aiModel: process.env.AI_MODEL ?? "",
  /** Ollama — OpenAI-compatible endpoint on the local LAN host. */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://pop-os.lan:11434",
  /** Selected in the 2026-09-07 eval (qwen2.5:7b — grounded, fast, no invention). */
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
  /** OpenRouter — dedicated RemindIt key (never committed; D9). */
  openRouterKey: process.env.OPENROUTER_REMINDIT_KEY,
  /**
   * Remote default. minimax-m3:free won the 2026-09-07 eval but the provider
   * retired it 2026-09-08 (paid-only); the sparse nemotron-3-super-120b-a12b:free
   * variant was re-verified live (grounding + tool-calling) and replaced it.
   */
  openRouterModel: process.env.OPENROUTER_MODEL ??
    "nvidia/nemotron-3-super-120b-a12b:free",
}
