// @remindit/common/health — server-side health-check helpers shared by every
// module. The barrel excludes `honoHealthRoute` on purpose: it lives at
// `@remindit/common/health/hono` so hono stays out of client bundles.

export { healthReport } from "./report"
export { healthResponse } from "./response"
export { healthFetchHandler } from "./fetch"
export { healthMiddleware } from "./middleware"
export type {
  HealthCheck,
  HealthOptions,
  HealthReport,
  HealthStatus,
} from "./types"
