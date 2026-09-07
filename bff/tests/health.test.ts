import { describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { healthResponseSchema } from "../src/contracts"

describe("GET /api/health", () => {
  test("reports liveness + PocketBase reachability", async () => {
    const res = await app.request("/api/health")
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = healthResponseSchema.parse(await res.json())
    expect(body.service).toBe("remindit-bff")
    expect(body.version).toBeDefined()
    expect(body.uptime).toBeGreaterThanOrEqual(0)
    // PB may legitimately be down in test environments — both are valid.
    expect(["up", "down"]).toContain(body.checks.pb)
  })
})
