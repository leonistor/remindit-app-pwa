import { afterAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { type AppType, app } from "../src/app"

// Live server + Hono RPC client: proves the AppType contract round-trips
// across a real HTTP boundary — what pwa/web/admin will do in later phases.
const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))

const client = hc<AppType>(`http://127.0.0.1:${server.port}`)

describe("Hono RPC contract", () => {
  test("health round-trip via hc<AppType>", async () => {
    // hc proxies mirror URL segments: /api/health → client.api.health
    const res = await client.api.health.$get()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.service).toBe("remindit-bff")
    expect(body.ok).toBe(true)
  })
})
