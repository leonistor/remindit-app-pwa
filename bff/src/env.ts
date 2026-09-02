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
  /** PocketBase internal URL — bound to localhost, never public (D2). */
  pocketbaseUrl: process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090",
  /** PocketBase data dir, resolved from the repo root (gitignored). */
  pocketbaseDataDir: process.env.POCKETBASE_DATA_DIR ?? "bff/pb_data",
  /** Dev-only superuser credentials (migrations + MCP + admin-side tests). */
  pocketbaseAdminEmail: process.env.POCKETBASE_ADMIN_EMAIL,
  pocketbaseAdminPassword: process.env.POCKETBASE_ADMIN_PASSWORD,
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
}
