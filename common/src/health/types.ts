// Shared health-check contract for every RemindIt server module (bff, web,
// admin, and the pwa dev/preview server). This is the server-side carve-out of
// @remindit/common: the root export stays framework-agnostic, while this
// subpath is hono/fetch/node aware by design (see common/README.md §Health).
// Pure types — no runtime values here.

export type HealthStatus = "up" | "down"

/** A dependency probe: a static status or an async function resolving one. */
export type HealthCheck =
  | HealthStatus
  | (() => HealthStatus | Promise<HealthStatus>)

export interface HealthReport {
  /** True when every named check reports "up". The HTTP status stays 200 regardless. */
  ok: boolean
  /** Stable service identifier, e.g. "remindit-bff". */
  service: string
  /** ISO timestamp of the report. */
  ts: string
  /** Process uptime in whole seconds. */
  uptime: number
  /** Module version (from its package.json) when provided. */
  version?: string
  /** Per-dependency status, keyed by check name. */
  checks: Record<string, HealthStatus>
}

export interface HealthOptions {
  version?: string
  checks?: Record<string, HealthCheck>
}
