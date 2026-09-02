// Env comes from the single root .env (D9), injected by the root scripts via
// `bun --env-file=../.env`. Every value has a dev-safe default so `bun test`
// and type-only consumers of the module never need configuration.

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const env = {
  /** Hono (Bun.serve) port. */
  port: positiveInt(process.env.PORT, 3100),
  /** PocketBase internal URL — bound to localhost, never public (D2). */
  pocketbaseUrl: process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090",
  /** PocketBase data dir, resolved from the repo root (gitignored). */
  pocketbaseDataDir: process.env.POCKETBASE_DATA_DIR ?? "bff/pb_data",
  /** Dev-only superuser credentials (migrations + MCP from phase 2 on). */
  pocketbaseAdminEmail: process.env.POCKETBASE_ADMIN_EMAIL,
  pocketbaseAdminPassword: process.env.POCKETBASE_ADMIN_PASSWORD,
}
