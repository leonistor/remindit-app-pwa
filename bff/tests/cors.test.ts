// CORS allowlist behavior (TODO P4) — unit-level, no PocketBase required:
// hono/cors echoes the request Origin only when it is on the env.corsOrigins
// allowlist, and answers OPTIONS preflights with a 204 short-circuit before
// any routing. Semantics verified against hono's cors source: a denied origin
// still receives a 204 preflight (allow-methods/max-age are set regardless)
// but NO access-control-allow-origin — which is what makes browsers block.
//
// The mounted middleware captured the env.corsOrigins ARRAY REFERENCE at app
// construction, so this suite swaps the allowlist by mutating it in place —
// reassignment would be invisible to the already-configured app.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { env } from "../src/env"

const ALLOWED = "http://allowed.example:4100"
const DENIED = "http://evil.example:4199"

const ORIGINALS = [...env.corsOrigins]

beforeAll(() => {
  env.corsOrigins.length = 0
  env.corsOrigins.push(ALLOWED)
})
afterAll(() => {
  env.corsOrigins.length = 0
  env.corsOrigins.push(...ORIGINALS)
})

const preflight = (origin: string) =>
  app.request("/api/auth/me", {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "DELETE",
      "access-control-request-headers": "content-type",
    },
  })

describe("CORS allowlist (unit)", () => {
  test("preflight from an allowlisted origin → 204 with the origin echoed", async () => {
    const res = await preflight(ALLOWED)
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED)
    expect(res.headers.get("access-control-allow-methods")).toContain("DELETE")
    expect(res.headers.get("access-control-max-age")).toBe("86400")
  })

  test("preflight from a non-allowlisted origin → 204 but no allow-origin (browser blocks)", async () => {
    const res = await preflight(DENIED)
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("GET from an allowlisted origin → allow-origin echoed (also on error responses)", async () => {
    // /api/auth/me without credentials is a deterministic PB-free 401: the
    // CORS middleware applies its headers before routing, so error responses
    // carry them too.
    const res = await app.request("/api/auth/me", {
      headers: { origin: ALLOWED },
    })
    expect(res.status).toBe(401)
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED)
  })

  test("GET from a non-allowlisted origin → no allow-origin", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { origin: DENIED },
    })
    expect(res.status).toBe(401)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("request without an Origin header (same-origin) → no allow-origin", async () => {
    const res = await app.request("/api/auth/me")
    expect(res.status).toBe(401)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })
})
