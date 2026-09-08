// Feedback endpoint (phase 2): write-only bug/feature capture. Runs via
// app.request() against the real app with the PocketBase SDK's collection()
// stubbed on the prototype (the groups.test.ts convention) — no HTTP happens.
// optionalAuth lets anonymous callers through (shared `pb` client) and
// attributes from the token's claimed id on the Bearer path (fresh-token fast
// path, no PB round trip).

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import PocketBase from "pocketbase"
import { app } from "../src/app"
import { feedbackSchema } from "../src/contracts"

const SUBMIT_URL = "/api/feedback"

// A well-formed JWT with a future exp AND an id claim — the id claim is what
// the auth middleware's fresh-token fast path uses to set `auth.userId`
// without any PB round trip (a bare exp-only token would fall through to
// auth-refresh, which needs a live PB). `iat` is included so the token reads
// as fresh (without it the middleware applies the 48h fallback lifetime and
// treats a short-lived token as near expiry).
const authedToken = (id: string) => {
  const now = Math.floor(Date.now() / 1000)
  return `h.${btoa(
    JSON.stringify({ exp: now + 3600, iat: now - 3600, id })
  )}.s`
}

const state = {
  /** Rows the stubbed create received, in order — attribution assertions. */
  created: [] as Record<string, unknown>[],
}

beforeAll(() => {
  spyOn(PocketBase.prototype, "collection").mockImplementation(function (
    this: PocketBase,
    _name: string
  ) {
    return {
      create: async (data: Record<string, unknown>) => {
        state.created.push(data)
        return {
          id: `fb-${state.created.length}`,
          created: "2026-09-08 10:00:00.000Z",
          updated: "2026-09-08 10:00:00.000Z",
          ...data,
        }
      },
    } as never
  } as never)
})

afterAll(() => {
  mock.restore()
})

const submit = (init: RequestInit = {}) =>
  app.request(SUBMIT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...init,
  })

describe("POST /api/feedback (stubbed PB)", () => {
  test("anonymous submit → 201, un-attributed, contract parses", async () => {
    state.created = []
    const res = await submit({
      body: JSON.stringify({ kind: "bug", message: "It crashed" }),
    })
    expect(res.status).toBe(201)
    const body = feedbackSchema.parse(await res.json())
    expect(body.kind).toBe("bug")
    expect(body.message).toBe("It crashed")
    expect(body.user).toBeUndefined()
    // Anonymous rows carry no user relation into the create.
    expect(state.created[0].user).toBeUndefined()
  })

  test("authenticated submit → 201 attributed to the token's claimed id", async () => {
    state.created = []
    const res = await submit({
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authedToken("u-alice")}`,
      },
      body: JSON.stringify({
        kind: "feature",
        message: "Add dark mode",
        locale: "ro",
      }),
    })
    expect(res.status).toBe(201)
    const body = feedbackSchema.parse(await res.json())
    expect(body.user).toBe("u-alice")
    expect(state.created[0].user).toBe("u-alice")
  })

  test("invalid kind → 400", async () => {
    const res = await submit({
      body: JSON.stringify({ kind: "other", message: "x" }),
    })
    expect(res.status).toBe(400)
  })

  test("empty message → 400", async () => {
    const res = await submit({
      body: JSON.stringify({ kind: "bug", message: "" }),
    })
    expect(res.status).toBe(400)
  })

  test("missing body → 400", async () => {
    const res = await submit()
    expect(res.status).toBe(400)
  })
})