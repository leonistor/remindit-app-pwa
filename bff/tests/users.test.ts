// Users lookup (GET /api/users/lookup) — the group-invite username → userId
// resolver. Unit paths run unconditionally: the unauthenticated/validation
// boundaries never reach PocketBase, and the lookup flow runs against a
// stubbed PB (Bun.serve) like auth-middleware.test.ts. The live end-to-end
// block (hc<AppType> over a real PB) skips when PB is down — mirroring
// api.integration.test.ts — so `bun test` stays green in PB-less envs.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { type AppType, app } from "../src/app"
import {
  authResponseSchema,
  errorSchema,
  type UserPublic,
  userPublicSchema,
} from "../src/contracts"
import { env } from "../src/env"

const POCKETBASE_URL_ORIGINAL = env.pocketbaseUrl
const nowS = Math.floor(Date.now() / 1000)

// Middleware only decodes locally on the fresh-token fast path — an unsigned
// payload is fine for exercising it (no PB round trip before validation).
const makeJwt = (claims: Record<string, unknown>): string => {
  const enc = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.sig`
}
const freshJwt = makeJwt({
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  type: "auth",
  id: "u1",
  iat: nowS - 3600,
  exp: nowS + 14 * 24 * 60 * 60,
})
const authHeader = { authorization: `Bearer ${freshJwt}` }

describe("users lookup boundaries (no PB required)", () => {
  test("unauthenticated → 401 with the error contract", async () => {
    const res = await app.request("/api/users/lookup?username=alice")
    expect(res.status).toBe(401)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("authentication required")
  })

  test("invalid username → 400 { error: 'validation failed', details } (H10 hook on query)", async () => {
    // Auth passes via the local fast path; validation rejects before any PB
    // call — proves the published error contract holds for query validation.
    const res = await app.request("/api/users/lookup?username=has%20space", {
      headers: authHeader,
    })
    expect(res.status).toBe(400)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("validation failed")
    const details = body.details as {
      formErrors: string[]
      fieldErrors: Record<string, string[]>
    }
    expect(details.formErrors).toEqual([])
    expect(details.fieldErrors.username?.length).toBeGreaterThan(0)
  })
})

describe("users lookup against a stubbed PB", () => {
  const aliceRecord = {
    id: "u-alice",
    username: "alice",
    email: "alice@test.local",
    firstName: "Alice",
    lastName: "",
    avatar: "",
  }
  let seenFilter: string | undefined
  const stub = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (
        req.method === "GET" &&
        url.pathname === "/api/collections/users/records"
      ) {
        seenFilter = url.searchParams.get("filter") ?? undefined
        // The SDK interpolates string params double-quoted; accept either
        // quote style so the stub doesn't couple to that detail.
        const match = /username\s*=\s*["']([^"']+)["']/.exec(seenFilter ?? "")
        const items = match?.[1] === "alice" ? [aliceRecord] : []
        const totalItems = items.length
        return Response.json({
          page: 1,
          perPage: 1,
          totalItems,
          totalPages: totalItems,
          items,
        })
      }
      return Response.json({ message: "not found" }, { status: 404 })
    },
  })

  beforeAll(() => {
    seenFilter = undefined
    env.pocketbaseUrl = `http://127.0.0.1:${stub.port}`
  })
  afterAll(() => {
    env.pocketbaseUrl = POCKETBASE_URL_ORIGINAL
    stub.stop(true)
  })

  test("existing username → mapped UserPublic with masked email", async () => {
    const res = await app.request("/api/users/lookup?username=alice", {
      headers: authHeader,
    })
    expect(res.status).toBe(200)
    const user: UserPublic = userPublicSchema.parse(await res.json())
    expect(user.id).toBe("u-alice")
    expect(user.username).toBe("alice")
    expect(user.email).toBe("")
    expect(user.firstName).toBe("Alice")
    // The service actually filtered on the exact requested username.
    expect(seenFilter).toContain("alice")
  })

  test("unknown username → 404 { error: 'user not found' }", async () => {
    const res = await app.request("/api/users/lookup?username=nobody", {
      headers: authHeader,
    })
    expect(res.status).toBe(404)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("user not found")
  })
})

// --- live end-to-end (real PocketBase) ---------------------------------------

const pbUp = await fetch(`${POCKETBASE_URL_ORIGINAL}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)
const describeIfPb = pbUp ? describe : describe.skip

describeIfPb("users lookup API (live)", () => {
  const server = Bun.serve({ port: 0, fetch: app.fetch })
  afterAll(() => server.stop(true))
  const base = `http://127.0.0.1:${server.port}`
  const client = hc<AppType>(base)

  // Unique per run (unique username/email indexes on PB).
  const run = Date.now().toString(36)
  const password = process.env.TEST_PASSWORD ?? "secret12345"
  const authOptions = (token: string) => ({
    headers: { authorization: `Bearer ${token}` },
  })

  const register = async (username: string) => {
    const res = await client.api.auth.register.$post({
      json: {
        email: `${username}@test.local`,
        password,
        passwordConfirm: password,
        username,
      },
    })
    expect(res.status).toBe(201)
    return authResponseSchema.parse(await res.json())
  }

  let alice: Awaited<ReturnType<typeof register>>
  beforeAll(async () => {
    alice = await register(`lu-${run}`)
  })

  test("registered username resolves; email masked in the response", async () => {
    const res = await client.api.users.lookup.$get(
      { query: { username: alice.user.username } },
      authOptions(alice.token)
    )
    expect(res.status).toBe(200)
    const user = userPublicSchema.parse(await res.json())
    expect(user.username).toBe(alice.user.username)
    expect(user.email).toBe("")
  })

  test("unknown username → 404 with the error contract", async () => {
    const res = await client.api.users.lookup.$get(
      { query: { username: `ghost-${run}` } },
      authOptions(alice.token)
    )
    expect(res.status).toBe(404)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("user not found")
  })

  test("unauthenticated live call → 401", async () => {
    const res = await client.api.users.lookup.$get({
      query: { username: alice.user.username },
    })
    expect(res.status).toBe(401)
  })
})
