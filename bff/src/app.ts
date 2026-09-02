import { Hono } from "hono"
import { health } from "./routes/health"
import { sse } from "./routes/sse"

// The BFF application. Route modules are chained so the inferred AppType
// stays precise for Hono RPC clients (D8). Frontends do
// `import type { AppType } from "@remindit/bff/api"` — type-only, so the
// server graph is never pulled into client bundles.
export const app = new Hono()
  .route("/api/health", health)
  .route("/api/sse", sse)

export type AppType = typeof app
