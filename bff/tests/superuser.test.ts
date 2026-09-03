// Unit tests for the cached superuser client + single-flight 401 re-auth —
// no live PocketBase needed: collection() is stubbed on the SDK prototype,
// so the real singleton, authStore state machine and retry logic all run.

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import PocketBase, { ClientResponseError } from "pocketbase"

// The module under test reads superuser creds from env at import time.
// Provide dummies before it loads (the root test scripts already supply the
// real ones, making these a no-op there); the stub never touches a live PB.
process.env.POCKETBASE_ADMIN_EMAIL ??= "admin@test.local"
process.env.POCKETBASE_ADMIN_PASSWORD ??= "test-password"

const { forSuperuser, withSuperuser } = await import(
  "../src/repositories/pocketbase"
)

// Stub state, reset per test; read by the collection() replacement below.
let authAttempts = 0
let authDelayMs = 0
let authFailure: Error | undefined
let listAttempts = 0
let listFailuresRemaining = 0
let listFailureStatus = 401

// A well-formed JWT with a future exp — the SDK's authStore.isValid decodes
// the payload, so a dummy string would never count as authenticated.
const futureToken = () =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.s`

// RecordModel-shaped so the stubbed getList return typechecks like the SDK's.
const statsRow = {
  id: "stats1",
  collectionId: "c_platform_stats",
  collectionName: "platform_stats",
  users: 1,
  teams: 2,
}

let superuserClient: PocketBase

beforeAll(async () => {
  spyOn(PocketBase.prototype, "collection").mockImplementation(
    function (this: PocketBase, _name: string) {
      return {
        authWithPassword: async () => {
          authAttempts++
          if (authDelayMs > 0) await Bun.sleep(authDelayMs)
          if (authFailure) throw authFailure
          // Mimic the SDK's authResponse: persist the session so
          // authStore.isValid flips.
          this.authStore.save(futureToken(), { id: "superuser" } as never)
        },
        getList: async () => {
          listAttempts++
          if (listFailuresRemaining > 0) {
            listFailuresRemaining--
            throw new ClientResponseError({
              status: listFailureStatus,
              response: { code: listFailureStatus },
            })
          }
          return { items: [statsRow], totalItems: 1 }
        },
      } as never
    } as never
  )
  superuserClient = await forSuperuser()
})

afterAll(() => {
  mock.restore()
})

beforeEach(() => {
  authAttempts = 0
  authDelayMs = 0
  authFailure = undefined
  listAttempts = 0
  listFailuresRemaining = 0
  listFailureStatus = 401
  // Start every test from a logged-out superuser client.
  superuserClient.authStore.clear()
})

describe("superuser client cache + re-auth", () => {
  test("repeated calls reuse one client and one auth round trip", async () => {
    const first = await forSuperuser()
    const second = await forSuperuser()
    let seenByWithSuperuser: PocketBase | undefined
    await withSuperuser(async (client) => {
      seenByWithSuperuser = client
    })
    expect(second).toBe(first)
    expect(seenByWithSuperuser).toBe(first)
    expect(authAttempts).toBe(1)
  })

  test("concurrent first calls share one auth (no stampede)", async () => {
    authDelayMs = 10
    const [a, b] = await Promise.all([forSuperuser(), forSuperuser()])
    expect(b).toBe(a)
    expect(authAttempts).toBe(1)
  })

  test("a 401 on the first attempt re-auths once and retries on the same client", async () => {
    await forSuperuser() // initial auth
    listFailuresRemaining = 1
    const seen: PocketBase[] = []
    const result = await withSuperuser(async (client) => {
      seen.push(client)
      return client.collection("platform_stats").getList(1, 1)
    })
    expect(result.items[0]).toEqual(statsRow)
    expect(seen[0]).toBe(seen[1])
    expect(seen[0]).toBe(superuserClient)
    expect(listAttempts).toBe(2)
    expect(authAttempts).toBe(2) // initial + exactly one re-auth
  })

  test("concurrent 401s share a single re-auth", async () => {
    await forSuperuser() // initial auth
    authDelayMs = 10 // keep the re-auth in-flight while both callers hit it
    listFailuresRemaining = 2 // both first attempts fail
    const [a, b] = await Promise.all([
      withSuperuser((client) =>
        client.collection("platform_stats").getList(1, 1)
      ),
      withSuperuser((client) =>
        client.collection("platform_stats").getList(1, 1)
      ),
    ])
    expect(a.items[0]).toEqual(statsRow)
    expect(b.items[0]).toEqual(statsRow)
    expect(listAttempts).toBe(4) // 2 failed + 2 successful retries
    expect(authAttempts).toBe(2) // initial + ONE shared re-auth
  })

  test("a 403 is a real result — surfaced without retry or re-auth", async () => {
    await forSuperuser() // initial auth
    listFailuresRemaining = 1
    listFailureStatus = 403
    const error = await withSuperuser((client) =>
      client.collection("platform_stats").getList(1, 1)
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClientResponseError)
    expect((error as ClientResponseError).status).toBe(403)
    expect(listAttempts).toBe(1)
    expect(authAttempts).toBe(1)
  })

  test("network-level errors (status 0) are not retried either", async () => {
    await forSuperuser() // initial auth
    listFailuresRemaining = 1
    listFailureStatus = 0
    const error = await withSuperuser((client) =>
      client.collection("platform_stats").getList(1, 1)
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClientResponseError)
    expect((error as ClientResponseError).status).toBe(0)
    expect(listAttempts).toBe(1)
    expect(authAttempts).toBe(1)
  })

  test("a failed auth is not cached — the next caller re-attempts", async () => {
    authFailure = new Error("bad credentials")
    await expect(forSuperuser()).rejects.toThrow("bad credentials")
    authFailure = undefined
    await forSuperuser()
    expect(authAttempts).toBe(2)
  })
})
