import { Hono } from "hono"
import { cors } from "hono/cors"
import { pbErrorResponse } from "./lib/pb-error"
import { env } from "./env"
import { requireAuth, type AppEnv } from "./middleware/auth"
import { admin } from "./routes/admin"
import { auth } from "./routes/auth"
import { groups } from "./routes/groups"
import { health } from "./routes/health"
import { notifications } from "./routes/notifications"
import { pb } from "./routes/pb"
import { sse } from "./routes/sse"
import { stats } from "./routes/stats"
import { users } from "./routes/users"

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
  // Frontends live on separate origins (dev ports / prod subdomains) — answer
  // preflights for the allowlisted ones only (env.corsOrigins). Mounted first
  // so every route below (including the /pb/* forwarder's SSE streams) gets
  // the headers; with an allowlist hono echoes the request origin only when
  // it matches, and OPTIONS short-circuits before the route handlers.
  // X-Session-Token is exposed so cross-origin clients can persist the
  // rotated token (near-expiry refresh) and keep their session alive.
  .use(
    "*",
    cors({
      origin: env.corsOrigins,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["content-type", "authorization"],
      exposeHeaders: ["x-session-token"],
      credentials: true,
      maxAge: 86400,
    }),
  )
  .route("/api/health", health)
  .route("/api/auth", auth)
  .route("/api/groups", groups)
  .route("/api/users", users)
  .route("/api/notifications", notifications)
  .route("/api/admin", admin)
  .route("/api/stats", stats)
  .route("/pb", pb)
  .route("/api/sse", sse)

export type { AppEnv }
// Re-exported for convenience of server-side consumers (scripts/tests).
export { requireAuth }
export type AppType = typeof app
