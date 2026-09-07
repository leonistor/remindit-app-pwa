import type {
  HealthCheck,
  HealthOptions,
  HealthReport,
  HealthStatus,
} from "./types"

// Module-load timestamp feeds the uptime field. Keeps report.ts free of the
// `process` global so consumers with only DOM globals (web/admin) can typecheck
// the shared source without node types.
const STARTED = Date.now()

// Never throws: a throwing check is a "down" dependency, not a crash. The
// health endpoint must answer even while a dependency is mid-startup (the bff
// boots before PocketBase is reachable), so a probe failure is folded into the
// report instead of surfacing as a 500.
async function resolveCheck(check: HealthCheck): Promise<HealthStatus> {
  try {
    const value = typeof check === "function" ? await check() : check
    return value === "up" ? "up" : "down"
  } catch {
    return "down"
  }
}

/**
 * Build the health report for a service. Checks run sequentially so the
 * report is deterministic (no interleaved probe side effects).
 */
export async function healthReport(
  service: string,
  options: HealthOptions = {}
): Promise<HealthReport> {
  const checks: Record<string, HealthStatus> = {}
  for (const [name, check] of Object.entries(options.checks ?? {})) {
    checks[name] = await resolveCheck(check)
  }
  return {
    ok: Object.values(checks).every((status) => status === "up"),
    service,
    ts: new Date().toISOString(),
    uptime: Math.round((Date.now() - STARTED) / 1000),
    ...(options.version ? { version: options.version } : {}),
    checks,
  }
}
