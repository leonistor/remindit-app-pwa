import { Hono } from "hono"
import { pbErrorResponse } from "./lib/pb-error"
import { type AppEnv, requireAuth } from "./middleware/auth"
import { auth } from "./routes/auth"
import { groups } from "./routes/groups"
import { health } from "./routes/health"
import { notifications } from "./routes/notifications"
import { sse } from "./routes/sse"

// The BFF application. Route modules are chained so the inferred AppType
// stays precise for Hono RPC clients (D8). Frontends do
// `import type { AppType } from "@remindit/bff/api"` — type-only, so the
// server graph is never pulled into client bundles.
export const app = new Hono<AppEnv>()
  // PB errors bubble out of services and are shaped here, once (D8).
  .onError((error, c) => {
    const mapped = pbErrorResponse(error)
    if (mapped) {
      return c.json(mapped.body, mapped.status as never)
    }
    console.error("[bff] unhandled error:", error)
    return c.json({ error: "internal server error" }, 500)
  })
  .route("/api/health", health)
  .route("/api/auth", auth)
  .route("/api/groups", groups)
  .route("/api/notifications", notifications)
  .route("/api/sse", sse)

export type { AppEnv }
// Re-exported for convenience of server-side consumers (scripts/tests).
export { requireAuth }
export type AppType = typeof app
