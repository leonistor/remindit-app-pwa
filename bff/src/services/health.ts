import type { HealthResponse } from "../contracts"
import { pb } from "../repositories/pocketbase"

export const healthService = {
  // Liveness of the BFF itself + reachability of the internal PocketBase.
  // Never throws: PB being down is a reported state ("pb: down"), not a
  // crash — the BFF must boot (and answer) even while PB is starting up.
  async check(): Promise<HealthResponse> {
    let pbStatus: HealthResponse["pb"] = { status: "down" }
    try {
      const res = await pb.health.check()
      if (res.code === 200) pbStatus = { status: "up" }
    } catch {
      // PB unreachable — reported as "down"
    }
    return { ok: true, service: "remindit-bff", pb: pbStatus }
  },
}
