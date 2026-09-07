import type { HealthStatus } from "@remindit/common/health"
import { pb } from "../repositories/pocketbase"

export const healthService = {
  // PocketBase reachability probe for the shared health endpoint. Never
  // throws: PB being down is a reported state ("down"), not a crash — the
  // BFF must boot (and answer) even while PB is starting up.
  async pb(): Promise<HealthStatus> {
    try {
      const res = await pb.health.check()
      return res.code === 200 ? "up" : "down"
    } catch {
      return "down"
    }
  },
}
