// Unit tests (no PocketBase/Answer required): the username mapping, the
// throwaway credential shape, and the Answer client's wire contract —
// including the idempotency mapping of Answer's "exists" guard. The full
// register → provision flow is verified live (see README).

import { describe, expect, test } from "bun:test"
import {
  AnswerClient,
  AnswerUnavailableError,
} from "../src/repositories/answer"
import {
  sanitizeAnswerUsername,
  throwawayPassword,
} from "../src/services/feedback"

const envelope = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("sanitizeAnswerUsername", () => {
  test("mirrors Answer's slug normalization (lowercase, underscore → dash)", () => {
    expect(sanitizeAnswerUsername("DevA22852")).toBe("deva22852")
    expect(sanitizeAnswerUsername("brave_otter_42")).toBe("brave-otter-42")
  })

  test("truncates to Answer's 30-char username cap", () => {
    expect(sanitizeAnswerUsername("a".repeat(64)).length).toBe(30)
  })
})

describe("throwawayPassword", () => {
  test("satisfies Answer's 8+ char policy and is random", () => {
    expect(throwawayPassword().length).toBeGreaterThan(8)
    expect(throwawayPassword()).not.toBe(throwawayPassword())
  })
})

describe("AnswerClient.createUser", () => {
  // Fresh client per test — the token memo must not leak between cases.
  const makeClient = () => {
    const fetchCalls: { url: string; init?: RequestInit }[] = []
    let respond: () => Response
    const client = new AnswerClient((url, init) => {
      fetchCalls.push({ url, init })
      return Promise.resolve(respond())
    })
    // First call is always the admin login, subsequent calls see `next`.
    let call = 0
    const loginThen = (next: () => Response) => {
      respond = () =>
        call++ === 0
          ? envelope({
              code: 200,
              reason: "base.success",
              data: { access_token: "tok" },
            })
          : next()
    }
    return { client, fetchCalls, loginThen }
  }

  test("posts the admin add-user payload and reports created", async () => {
    const { client, fetchCalls, loginThen } = makeClient()
    loginThen(() => envelope({ code: 200, reason: "base.success", data: null }))
    const outcome = await client.createUser({
      username: "alice",
      email: "a@b.co",
      password: "secret-pass-123",
      displayName: "alice",
    })
    expect(outcome).toBe("created")
    const addBody = fetchCalls[1]?.init?.body as string
    expect(JSON.parse(addBody)).toEqual({
      username: "alice",
      email: "a@b.co",
      password: "secret-pass-123",
      display_name: "alice",
    })
    expect(fetchCalls[1]?.init?.headers).toMatchObject({ Authorization: "tok" })
  })

  test("maps Answer's uniqueness guard to exists (idempotent provisioning)", async () => {
    const { client, loginThen } = makeClient()
    loginThen(() =>
      envelope({
        code: 400,
        reason: "user.check_username_or_email_exist",
        msg: "has exist",
      })
    )
    const outcome = await client.createUser({
      username: "alice",
      email: "a@b.co",
      password: "x".repeat(10),
      displayName: "alice",
    })
    expect(outcome).toBe("exists")
  })

  test("surfaces other Answer rejections as errors", async () => {
    const { client, loginThen } = makeClient()
    loginThen(() =>
      envelope({
        code: 400,
        reason: "user.password_policy",
        msg: "weak password",
      })
    )
    expect(
      client.createUser({
        username: "a",
        email: "a@b.co",
        password: "x",
        displayName: "a",
      })
    ).rejects.toThrow("Answer user creation failed")
  })

  test("network failure → AnswerUnavailableError", async () => {
    const failing = new AnswerClient(() =>
      Promise.reject(new TypeError("fetch failed"))
    )
    expect(
      failing.createUser({
        username: "a",
        email: "a@b.co",
        password: "x".repeat(8),
        displayName: "a",
      })
    ).rejects.toBeInstanceOf(AnswerUnavailableError)
  })
})
