// Auth middleware session lifecycle (H7/H8) — runs unconditionally, without a
// live PocketBase: the rotation decision is unit-tested on local JWT claims,
// rotation delivery runs against a stubbed PB (Bun.serve), and the outage
// path points the PB client at a dead port. repositories/pocketbase.ts reads
// env.pocketbaseUrl at call time, so tests swap it and restore it.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { errorSchema } from "../src/contracts"
import { env } from "../src/env"
import { decodeJwtPayload, shouldRotate } from "../src/middleware/auth"

const POCKETBASE_URL_ORIGINAL = env.pocketbaseUrl
const nowS = Math.floor(Date.now() / 1000)

// Middleware only decodes — an unsigned payload is fine for exercising it.
const makeJwt = (claims: Record<string, unknown>): string => {
  const enc = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.sig`
}

const claims = (extra: Record<string, unknown>) => ({
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  type: "auth",
  id: "u1",
  ...extra,
})

const freshJwt = makeJwt(
  claims({ iat: nowS - 3600, exp: nowS + 14 * 24 * 60 * 60 })
)
const nearExpiryJwt = makeJwt(
  claims({ iat: nowS - 14 * 24 * 60 * 60, exp: nowS + 60 })
)

describe("rotation decision (local JWT decode)", () => {
  test("decodes base64url payloads; non-JWT input → null", () => {
    expect(decodeJwtPayload(freshJwt)).toMatchObject({ id: "u1" })
    expect(decodeJwtPayload("garbage")).toBeNull()
    expect(decodeJwtPayload("a.not-json.c")).toBeNull()
  })

  test("fresh token is kept; near expiry forces rotation", () => {
    const freshClaims = decodeJwtPayload(freshJwt)
    const nearClaims = decodeJwtPayload(nearExpiryJwt)
    if (!freshClaims || !nearClaims) throw new Error("unreachable")
    expect(shouldRotate(freshClaims)).toBe(false)
    expect(shouldRotate(nearClaims)).toBe(true)
  })

  test("unusable exp fails closed onto the PB-validated refresh path", () => {
    expect(shouldRotate({})).toBe(true)
    expect(shouldRotate({ exp: Number.NaN })).toBe(true)
  })
})

describe("token rotation delivery (stubbed PB)", () => {
  let refreshCalls: number
  const stubRecord = {
    id: "u1",
    username: "alice",
    email: "a@b.c",
    firstName: "",
    lastName: "",
    avatar: "",
  }
  const stub = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === "/api/collections/users/auth-refresh") {
        refreshCalls++
        // Real PB validates the signature; the stub mimics that by rejecting
        // anything that does not even look like a JWT.
        if (!(req.headers.get("authorization") ?? "").startsWith("ey")) {
          return Response.json({ message: "invalid token" }, { status: 401 })
        }
        return Response.json({ token: "fresh-token", record: stubRecord })
      }
      if (pathname === "/api/collections/users/records/u1") {
        return Response.json(stubRecord)
      }
      return Response.json({ message: "not found" }, { status: 404 })
    },
  })

  beforeAll(() => {
    refreshCalls = 0
    env.pocketbaseUrl = `http://127.0.0.1:${stub.port}`
  })
  afterAll(() => {
    env.pocketbaseUrl = POCKETBASE_URL_ORIGINAL
    stub.stop(true)
  })

  test("fresh token → fast path: /me works, no refresh call, no rotation header", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${freshJwt}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-session-token")).toBeNull()
    expect(refreshCalls).toBe(0)
  })

  test("near-expiry Bearer → rotated: X-Session-Token carries the fresh token", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${nearExpiryJwt}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-session-token")).toBe("fresh-token")
    expect(refreshCalls).toBe(1)
  })

  test("near-expiry cookie session → cookie re-issued with the fresh token", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { cookie: `remindit_session=${nearExpiryJwt}` },
    })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("remindit_session=fresh-token")
    expect(setCookie).not.toContain(nearExpiryJwt)
  })

  test("undecodable token still goes to PB and fails closed (401)", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { authorization: "Bearer garbage" },
    })
    expect(res.status).toBe(401)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("invalid or expired token")
  })
})

describe("PB outage (H8)", () => {
  const withDeadPb = async (
    run: () => Promise<void>
  ): Promise<void> => {
    env.pocketbaseUrl = "http://127.0.0.1:1" // port 1: nothing listens
    try {
      await run()
    } finally {
      env.pocketbaseUrl = POCKETBASE_URL_ORIGINAL
    }
  }

  test("unparseable token → 503 retryable, not 401", async () => {
    await withDeadPb(async () => {
      const res = await app.request("/api/auth/me", {
        headers: { authorization: "Bearer garbage" },
      })
      expect(res.status).toBe(503)
      const body = errorSchema.parse(await res.json())
      expect(body.error).toContain("unavailable")
    })
  })

  test("fresh token is accepted by the middleware during an outage (503 comes from the record read)", async () => {
    await withDeadPb(async () => {
      const res = await app.request("/api/auth/me", {
        headers: { authorization: `Bearer ${freshJwt}` },
      })
      // No 401: the fast path passed the middleware; the 503 is the on-demand
      // record read failing, mapped by app.onError.
      expect(res.status).toBe(503)
      const body = errorSchema.parse(await res.json())
      expect(body.error).toContain("unavailable")
    })
  })
})
