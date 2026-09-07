import { honoHealthRoute } from "@remindit/common/health/hono"
import bffPkg from "../../package.json"
import { healthService } from "../services/health"

// Shared /api/health: always 200 while the BFF is alive; PocketBase health is
// carried in the body (`ok` + `checks.pb`) for monitoring tools. bm2 probes
// reachability only, so a down PB must not read as a dead process.
export const health = honoHealthRoute("remindit-bff", {
  version: bffPkg.version,
  checks: { pb: healthService.pb },
})
