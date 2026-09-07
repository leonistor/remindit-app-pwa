import { Hono } from "hono"
import { healthReport } from "./report"
import type { HealthOptions } from "./types"

// Hono route factory for the bff: mounts `GET /health` returning the shared
// JSON report. Kept in its own subpath (`@remindit/common/health/hono`) so
// hono never enters the pwa/web/admin import graph — those modules only use
// the fetch/middleware adapters.
//
// The return type is deliberately inferred (no `: Hono` annotation): the bff
// chains this into its app and the RPC schema must survive for
// `hc<AppType>` clients, which an erased `Hono` return type would lose.
export function honoHealthRoute(service: string, options: HealthOptions = {}) {
  return new Hono().get("/", async (c) => {
    const report = await healthReport(service, options)
    c.header("cache-control", "no-store")
    return c.json(report)
  })
}
