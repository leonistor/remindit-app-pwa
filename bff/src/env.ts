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
   * Apache Answer (feedback sidecar) — internal base URL + admin credentials.
   * The bridge logs in as this admin to provision app users at registration
   * (one-way; see services/feedback.ts). Defaults match .env.example.
   */
  answerInternalUrl: process.env.ANSWER_INTERNAL_URL ?? "http://127.0.0.1:5555",
  answerAdminName: process.env.ANSWER_ADMIN_NAME ?? "remindit_admin",
  answerAdminEmail:
    process.env.ANSWER_ADMIN_EMAIL ?? "feedback-admin@remindit.local",
  answerAdminPassword:
    process.env.ANSWER_ADMIN_PASSWORD ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("ANSWER_ADMIN_PASSWORD is required in production")
        })()
      : "change-me-dev-only"),
  /**
   * Bridge secret for deriving deterministic per-user Answer passwords
   * (HMAC-SHA256, see services/feedback.ts). Must never leak — knowing it lets
   * anyone derive (and therefore log in as) every provisioned Answer twin.
   */
  answerBridgeSecret:
    process.env.ANSWER_BRIDGE_SECRET ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("ANSWER_BRIDGE_SECRET is required in production")
        })()
      : "dev-bridge-secret-change-me"),
  /** Public feedback base URL — used to build the public question URL. */
  feedbackPublicUrl:
    process.env.PUBLIC_FEEDBACK_URL ??
    process.env.ANSWER_INTERNAL_URL ??
    "http://127.0.0.1:5555",
  /** Fixed identity for the shared guest twin (web feedback, no PB linkage). */
  feedbackGuestEmail:
    process.env.ANSWER_GUEST_EMAIL ?? "feedback-guest@remindit.local",
  /**
   * SMTP settings for the `configure:feedback smtp` script. Values may be
   * undefined — the script errors clearly when host/from are missing.
   */
  smtp: {
    host: process.env.SMTP_HOST,
    port: positiveInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    fromName: process.env.SMTP_FROM_NAME,
    encryption: process.env.SMTP_ENCRYPTION ?? "",
  },
  /** Optional test-recipient for the SMTP configure script. */
  smtpTestEmail: process.env.SMTP_TEST_EMAIL,
}
