// Unit tests (no PocketBase required): unauthenticated boundaries and the
// published request contracts. Live API flows live in api.integration.test.ts.

import { describe, expect, test } from "bun:test"
import { app } from "../src/app"
import {
  errorSchema,
  loginBodySchema,
  registerBodySchema,
} from "../src/contracts"

describe("auth boundaries", () => {
  test("GET /api/auth/me without any credentials → 401", async () => {
    const res = await app.request("/api/auth/me")
    expect(res.status).toBe(401)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("authentication required")
  })

  test("GET /api/groups without any credentials → 401", async () => {
    const res = await app.request("/api/groups")
    expect(res.status).toBe(401)
  })

  test("GET /api/notifications without any credentials → 401", async () => {
    const res = await app.request("/api/notifications")
    expect(res.status).toBe(401)
  })

  test("POST /api/auth/logout clears the session cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" })
    expect(res.status).toBe(204)
    // deleteCookie emits an expiry cookie (Max-Age=0) — the browser drops it.
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("remindit_session=")
    expect(setCookie).toContain("Max-Age=0")
  })
})

describe("request contracts", () => {
  test("register rejects mismatched passwords", () => {
    const result = registerBodySchema.safeParse({
      email: "a@b.co",
      password: process.env.TEST_PASSWORD ?? "secret12345",
      passwordConfirm: "different123",
      username: "alice",
    })
    expect(result.success).toBe(false)
  })

  test("register rejects invalid usernames", () => {
    const result = registerBodySchema.safeParse({
      email: "a@b.co",
      password: process.env.TEST_PASSWORD ?? "secret12345",
      passwordConfirm: process.env.TEST_PASSWORD ?? "secret12345",
      username: "has space",
    })
    expect(result.success).toBe(false)
  })

  test("login requires a well-formed email", () => {
    expect(
      loginBodySchema.safeParse({ email: "nope", password: "x" }).success
    ).toBe(false)
  })
})
