// Unit tests (no PocketBase/Answer required): the username mapping, the
// deterministic bridge password, and the Answer client's wire contract —
// including the idempotency mapping of Answer's "exists" guard and the
// submit/activate endpoints. The full register → provision flow is verified
// live (see README).

import { describe, expect, test } from "bun:test"
import {
  feedbackGuestBodySchema,
  feedbackSubmitBodySchema,
} from "../src/contracts"
import { env } from "../src/env"
import {
  AnswerClient,
  AnswerUnavailableError,
} from "../src/repositories/answer"
import {
  canonicalAnswerUsername,
  deriveAnswerPassword,
  sanitizeAnswerUsername,
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

  test("salts with userId suffix to prevent case collisions", () => {
    expect(sanitizeAnswerUsername("DevA22852", "abc123xyz")).toBe(
      "deva22852-3xyz"
    )
  })

  test("truncates slug to 24 chars before salting", () => {
    expect(sanitizeAnswerUsername("a".repeat(64), "abcd")).toBe(
      `${"a".repeat(24)}-abcd`
    )
  })

  test("truncates to 24-char slug when no userId", () => {
    expect(sanitizeAnswerUsername("a".repeat(64)).length).toBe(24)
  })
})

describe("canonicalAnswerUsername", () => {
  test("derives the name Answer actually stores (lowercase, space→dash)", () => {
    // Verified live: Answer ignores `username`, slugs display_name as
    // lowercase + spaces→dashes, PRESERVING underscores.
    expect(canonicalAnswerUsername("DevA22852")).toBe("deva22852")
    expect(canonicalAnswerUsername("Foo Bar")).toBe("foo-bar")
    expect(canonicalAnswerUsername("Brave_Otter_42")).toBe("brave_otter_42")
    expect(canonicalAnswerUsername("Foo_Bar Baz_UPPER")).toBe(
      "foo_bar-baz_upper"
    )
  })

  test("never applies the userId salt that sanitizeAnswerUsername would", () => {
    expect(canonicalAnswerUsername("alice")).toBe("alice")
    expect(sanitizeAnswerUsername("alice", "abc123xyz")).toBe("alice-3xyz")
    expect(canonicalAnswerUsername("alice")).not.toBe(
      sanitizeAnswerUsername("alice", "abc123xyz")
    )
  })
})

describe("feedback contracts", () => {
  test("text requires at least 6 chars (Answer content minimum)", () => {
    const submit = {
      subject: "Six chars",
      text: "123456",
      tag: "bug",
      fromModule: "pwa",
    }
    const guest = { subject: "Six chars", text: "123456", tag: "bug" }
    expect(
      feedbackSubmitBodySchema.safeParse({ ...submit, text: "12345" }).success
    ).toBe(false)
    expect(feedbackSubmitBodySchema.safeParse(submit).success).toBe(true)
    expect(
      feedbackGuestBodySchema.safeParse({ ...guest, text: "12345" }).success
    ).toBe(false)
    expect(feedbackGuestBodySchema.safeParse(guest).success).toBe(true)
  })

  test("subject requires at least 6 chars", () => {
    expect(
      feedbackSubmitBodySchema.safeParse({
        subject: "12345",
        text: "123456",
        tag: "bug",
        fromModule: "pwa",
      }).success
    ).toBe(false)
  })
})

describe("deriveAnswerPassword", () => {
  test("is deterministic for the same username and secret", () => {
    expect(deriveAnswerPassword("alice")).toBe(deriveAnswerPassword("alice"))
  })

  test("differs across usernames", () => {
    expect(deriveAnswerPassword("alice")).not.toBe(deriveAnswerPassword("bob"))
  })

  test("satisfies Answer's 8-32 char admin policy", () => {
    for (const username of ["alice", "web-guest", "deva22852-3xyz"]) {
      const password = deriveAnswerPassword(username)
      expect(password.length).toBeGreaterThanOrEqual(8)
      expect(password.length).toBeLessThanOrEqual(32)
    }
  })
})

describe("AnswerClient", () => {
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
    // No login — every call sees `respond`.
    const respondWith = (next: () => Response) => {
      respond = next
    }
    return { client, fetchCalls, loginThen, respondWith }
  }

  describe("createUser", () => {
    test("posts the admin add-user payload and reports created", async () => {
      const { client, fetchCalls, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 200, reason: "base.success", data: null })
      )
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
      expect(fetchCalls[1]?.init?.headers).toMatchObject({
        Authorization: "tok",
      })
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

  describe("listTags", () => {
    test("lists and maps tag fields (public, no token)", async () => {
      const { client, fetchCalls, respondWith } = makeClient()
      respondWith(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: {
            list: [
              {
                slug_name: "bug",
                display_name: "Bug",
                original_text: "A bug.",
              },
            ],
          },
        })
      )
      const tags = await client.listTags()
      expect(tags).toEqual([
        { slugName: "bug", displayName: "Bug", originalText: "A bug." },
      ])
      expect(fetchCalls[0]?.url).toBe(
        `${env.answerInternalUrl}/answer/api/v1/tags/page?page=1&page_size=100`
      )
    })

    test("throws AnswerError on non-200", async () => {
      const { client, respondWith } = makeClient()
      respondWith(() => envelope({ code: 400, reason: "tag.list_failed" }))
      expect(client.listTags()).rejects.toThrow("Answer tag list failed")
    })
  })

  describe("createTag", () => {
    test("posts the admin tag payload to the tag endpoint", async () => {
      const { client, fetchCalls, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 200, reason: "base.success", data: null })
      )
      await client.createTag({
        slugName: "bug",
        displayName: "Bug",
        originalText: "A bug.",
      })
      expect(fetchCalls[1]?.url).toBe(
        `${env.answerInternalUrl}/answer/api/v1/tag`
      )
      expect(JSON.parse(fetchCalls[1]?.init?.body as string)).toEqual({
        display_name: "Bug",
        original_text: "A bug.",
        slug_name: "bug",
      })
      expect(fetchCalls[1]?.init?.headers).toMatchObject({
        Authorization: "tok",
      })
    })

    test("throws AnswerError on rejection", async () => {
      const { client, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 400, reason: "tag.create_failed", msg: "nope" })
      )
      expect(
        client.createTag({
          slugName: "x",
          displayName: "X",
          originalText: "d",
        })
      ).rejects.toThrow("Answer tag creation failed")
    })
  })

  describe("resolveUserId", () => {
    test("resolves by username via the admin search (user_id key)", async () => {
      const { client, fetchCalls, loginThen } = makeClient()
      loginThen(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: { list: [{ user_id: "abc123", username: "alice" }] },
        })
      )
      expect(await client.resolveUserId("alice")).toBe("abc123")
      expect(fetchCalls[1]?.url).toBe(
        `${env.answerInternalUrl}/answer/admin/api/users/page?query=alice`
      )
    })

    test("falls back to the id key and matches by email", async () => {
      const { client, loginThen } = makeClient()
      loginThen(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: { list: [{ id: "xyz", email: "alice@b.co" }] },
        })
      )
      expect(await client.resolveUserId("alice@b.co")).toBe("xyz")
    })

    test("returns null when no user matches", async () => {
      const { client, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 200, reason: "base.success", data: { list: [] } })
      )
      expect(await client.resolveUserId("ghost")).toBeNull()
    })
  })

  describe("resetUserPassword", () => {
    test("PUTs user_id + password", async () => {
      const { client, fetchCalls, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 200, reason: "base.success", data: null })
      )
      await client.resetUserPassword("abc", "pass1234")
      expect(fetchCalls[1]?.url).toBe(
        `${env.answerInternalUrl}/answer/admin/api/user/password`
      )
      expect(fetchCalls[1]?.init?.method).toBe("PUT")
      expect(JSON.parse(fetchCalls[1]?.init?.body as string)).toEqual({
        user_id: "abc",
        password: "pass1234",
      })
    })
  })

  describe("activateUser", () => {
    test("posts to the singular route and succeeds on the JSON envelope", async () => {
      const { client, fetchCalls, loginThen } = makeClient()
      loginThen(() =>
        envelope({ code: 200, reason: "base.success", data: null })
      )
      await client.activateUser("abc")
      // The real gin route is singular; the plural path returns the SPA shell.
      expect(fetchCalls[1]?.url).toBe(
        `${env.answerInternalUrl}/answer/admin/api/user/activation`
      )
      expect(JSON.parse(fetchCalls[1]?.init?.body as string)).toEqual({
        user_id: "abc",
      })
    })

    test("fails loudly on a 2xx non-envelope body (SPA shell — wrong route)", async () => {
      const { client, loginThen } = makeClient()
      loginThen(
        () => new Response("<html><body>ok</body></html>", { status: 200 })
      )
      expect(client.activateUser("abc")).rejects.toThrow(
        "Answer user activation failed"
      )
    })

    test("throws AnswerError on a non-2xx status", async () => {
      const { client, loginThen } = makeClient()
      loginThen(() => new Response("not allowed", { status: 403 }))
      expect(client.activateUser("abc")).rejects.toThrow(
        "Answer user activation failed"
      )
    })
  })

  describe("loginAsUser", () => {
    test("returns the user access token", async () => {
      const { client, fetchCalls, respondWith } = makeClient()
      respondWith(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: { access_token: "user-tok" },
        })
      )
      expect(await client.loginAsUser("a@b.co", "pass")).toBe("user-tok")
      expect(fetchCalls[0]?.url).toBe(
        `${env.answerInternalUrl}/answer/api/v1/user/login/email`
      )
      expect(JSON.parse(fetchCalls[0]?.init?.body as string)).toEqual({
        e_mail: "a@b.co",
        pass: "pass",
      })
    })

    test("throws AnswerError on rejection", async () => {
      const { client, respondWith } = makeClient()
      respondWith(() => envelope({ code: 400, reason: "user.password_error" }))
      expect(client.loginAsUser("a@b.co", "x")).rejects.toThrow(
        "Answer user login failed"
      )
    })
  })

  describe("createQuestion", () => {
    test("builds the public question URL from the response id", async () => {
      const { client, fetchCalls, respondWith } = makeClient()
      respondWith(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: { id: "q123" },
        })
      )
      const url = await client.createQuestion("user-tok", {
        title: "Subject",
        content: "Body",
        tags: ["bug"],
      })
      expect(url).toBe(`${env.feedbackPublicUrl}/questions/q123`)
      expect(fetchCalls[0]?.url).toBe(
        `${env.answerInternalUrl}/answer/api/v1/question`
      )
      expect(fetchCalls[0]?.init?.headers).toMatchObject({
        Authorization: "user-tok",
      })
      const body = JSON.parse(fetchCalls[0]?.init?.body as string)
      expect(body.tags).toEqual([
        { display_name: "bug", original_text: "bug", slug_name: "bug" },
      ])
    })

    test("handles the question_id key fallback", async () => {
      const { client, respondWith } = makeClient()
      respondWith(() =>
        envelope({
          code: 200,
          reason: "base.success",
          data: { question_id: "q9" },
        })
      )
      const url = await client.createQuestion("t", {
        title: "Subject",
        content: "Body",
        tags: ["bug"],
      })
      expect(url).toBe(`${env.feedbackPublicUrl}/questions/q9`)
    })

    test("throws AnswerError on rejection", async () => {
      const { client, respondWith } = makeClient()
      respondWith(() =>
        envelope({ code: 400, reason: "question.title_invalid", msg: "bad" })
      )
      expect(
        client.createQuestion("t", {
          title: "x",
          content: "y",
          tags: [],
        })
      ).rejects.toThrow("Answer question creation failed")
    })
  })
})
