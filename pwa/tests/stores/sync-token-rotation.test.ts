// Token-rotation capture tests (P9): the BFF's auth middleware hands back
// rotated session tokens in the `X-Session-Token` response header of
// authenticated requests (near-expiry auth-refresh) — including /pb/*
// forwarder calls. The engine must capture them, or sessions die at the
// original login token's TTL.
//
// `pocketbase` is mocked (same pattern as sync-engine.test.ts, with the fake
// authStore recording saves) so the engine module is importable without a
// network client. `@/lib/bff-api` is deliberately NOT mocked: the wiring test
// proves that a real fetch response carrying the header flows through the
// real lib → the handler the engine injects at module init → the session
// store (stores → lib layering, handler injected).

import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core"
import { bffApi } from "@/lib/bff-api"
import { captureRotatedToken, signOut } from "@/stores/sync/engine"
import {
  getSession,
  patchSessionToken,
  setSession,
} from "@/stores/sync/session"
import { resetStores } from "../fixtures/reset"

const pbState = rs.hoisted(() => {
  const authSaves: Array<{ token: string; record: unknown }> = []
  class FakePocketBase {
    authStore = {
      save: (token: string, record: unknown) => {
        authSaves.push({ token, record })
      },
      clear: () => undefined,
    }
    autoCancellation(): void {}
    filter(): string {
      return ""
    }
    collection(): Record<string, never> {
      return {}
    }
  }
  const reset = () => {
    authSaves.length = 0
  }
  return { authSaves, reset, FakePocketBase }
})

rs.mock("pocketbase", () => ({ default: pbState.FakePocketBase }))

const EMAIL = "leo@example.com"
const SESSION = { token: "tok-old", userId: "u1", email: EMAIL }

/** 200 JSON response with optional extra headers (e.g. X-Session-Token). */
const jsonResponse = (
  body: unknown,
  headers: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  })

/** Serves every fetch through a stub and restores the original afterwards. */
async function withFetch(
  implementation: () => Promise<Response>,
  run: () => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch
  const fetchStub = rs.fn<() => Promise<Response>>()
  fetchStub.mockImplementation(implementation)
  globalThis.fetch = fetchStub as unknown as typeof fetch
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

beforeEach(() => {
  setSession({ ...SESSION })
  pbState.reset()
})

afterEach(async () => {
  await signOut()
  resetStores()
})

describe("session token rotation (X-Session-Token capture)", () => {
  test("patchSessionToken updates the token and preserves identity", () => {
    patchSessionToken("tok-new")
    expect(getSession()).toEqual({
      token: "tok-new",
      userId: SESSION.userId,
      email: EMAIL,
    })
  })

  test("patchSessionToken no-ops on the same token", () => {
    const session = getSession()
    patchSessionToken(SESSION.token)
    // Reference identity: a re-set would produce a fresh object.
    expect(getSession()).toBe(session)
  })

  test("captureRotatedToken patches the session and the pb auth store", () => {
    captureRotatedToken("tok-rotated")
    expect(getSession()).toEqual({
      token: "tok-rotated",
      userId: SESSION.userId,
      email: EMAIL,
    })
    expect(pbState.authSaves).toEqual([
      {
        token: "tok-rotated",
        record: expect.objectContaining({ id: SESSION.userId, email: EMAIL }),
      },
    ])
  })

  test("captureRotatedToken ignores missing and already-current headers", () => {
    captureRotatedToken(null)
    captureRotatedToken(undefined)
    captureRotatedToken(SESSION.token)
    expect(pbState.authSaves).toEqual([])
    expect(getSession()?.token).toBe(SESSION.token)
  })

  test("captureRotatedToken no-ops without a session", () => {
    setSession(null)
    captureRotatedToken("tok-rotated")
    expect(getSession()).toBeNull()
    expect(pbState.authSaves).toEqual([])
  })

  test("bff-api responses carrying X-Session-Token reach the session store", async () => {
    await withFetch(
      () =>
        jsonResponse({ email: EMAIL }, { "X-Session-Token": "tok-rotated" }),
      async () => {
        await bffApi.me(SESSION.token)
      }
    )
    expect(getSession()?.token).toBe("tok-rotated")
    expect(getSession()?.userId).toBe(SESSION.userId)
    expect(pbState.authSaves).toHaveLength(1)
  })

  test("bff-api responses without the header leave the session untouched", async () => {
    await withFetch(
      () => jsonResponse({ email: EMAIL }),
      async () => {
        await bffApi.me(SESSION.token)
      }
    )
    expect(getSession()?.token).toBe(SESSION.token)
    expect(pbState.authSaves).toEqual([])
  })
})

describe("unified client 401 policy (session-expiry sign-out)", () => {
  test("a 401 from an account-level RPC signs the engine out", async () => {
    await withFetch(
      () => new Response(JSON.stringify({ error: "authentication required" }), { status: 401 }),
      async () => {
        await expect(bffApi.me(SESSION.token)).rejects.toThrow()
      }
    )
    // The engine's injected unauthorized handler signed the session out.
    expect(getSession()).toBeNull()
  })
})
