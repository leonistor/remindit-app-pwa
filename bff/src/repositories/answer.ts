// Apache Answer HTTP client (repository layer, D8): Answer is an internal
// sidecar — the only module surface allowed to talk to it. Endpoints per the
// v2 swagger: login mints an admin access token; the admin API provisions
// users. Transport errors surface as AnswerUnavailableError so callers can
// degrade gracefully (the register hook is non-fatal).
import { env } from "../env"

/** Answer could not be reached — a retryable infra failure. */
export class AnswerUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "Answer (feedback) is temporarily unavailable",
      cause ? { cause } : undefined
    )
  }
}

/** Answer rejected the request (bad credentials, validation, etc.). */
export class AnswerError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly status: number
  ) {
    super(message)
  }
}

export type AnswerUserInput = {
  username: string
  email: string
  password: string
  displayName: string
}

type AnswerEnvelope = {
  code: number
  reason: string
  msg?: string
  data?: unknown
}

// Injectable for unit tests (mocked fetch); production uses the global.
type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

export class AnswerClient {
  private token: string | undefined
  constructor(private readonly fetchImpl: FetchImpl = fetch) {}

  /**
   * Mint (and memoize) an admin access token via email login. A 401 on any
   * subsequent call clears the memo (expired token) so the next call re-logins.
   */
  private async adminToken(): Promise<string> {
    if (this.token) return this.token
    const data = await this.request<
      AnswerEnvelope & { data: { access_token?: string } }
    >("/answer/api/v1/user/login/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        e_mail: env.answerAdminEmail,
        pass: env.answerAdminPassword,
      }),
    })
    if (data.code !== 200 || !data.data?.access_token) {
      throw new AnswerError("Answer admin login failed", data.reason, data.code)
    }
    this.token = data.data.access_token
    return this.token
  }

  /**
   * Raw request with the HTTP status — needed for endpoints that answer with
   * a non-JSON success body (activation redirects to the SPA HTML on 200).
   * `request` is built on this so every caller shares the 401-clears-token
   * memo and the 3s transport bound.
   */
  private async requestRaw(
    path: string,
    init: RequestInit
  ): Promise<{ status: number; body: unknown }> {
    let res: Response
    try {
      // Bounded: the bridge runs inline in register — a hung Answer must not
      // hang registration (3s covers the local sidecar many times over).
      res = await this.fetchImpl(`${env.answerInternalUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(3_000),
      })
    } catch (cause) {
      throw new AnswerUnavailableError(cause)
    }
    if (res.status === 401) this.token = undefined
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const { body } = await this.requestRaw(path, init)
    return body as T
  }

  /**
   * Create a user in Answer (admin API). Idempotency is the caller's concern —
   * this maps the wire result to a discriminated outcome:
   * - "created": the user now exists (freshly created)
   * - "exists": Answer reports the username/email as taken — for the bridge
   *   this means a previous provisioning attempt landed; safe to link.
   */
  async createUser(input: AnswerUserInput): Promise<"created" | "exists"> {
    const token = await this.adminToken()
    const data = await this.request<AnswerEnvelope>("/answer/admin/api/user", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        password: input.password,
        display_name: input.displayName,
      }),
    })
    if (data.code === 200) return "created"
    // Answer's uniqueness guard — treat as already-provisioned (one-way
    // bridge: the Answer side is the source of truth for its own users).
    if (
      /exist/i.test(data.reason) ||
      (data.msg && /exist|already/i.test(data.msg))
    ) {
      return "exists"
    }
    throw new AnswerError(
      `Answer user creation failed: ${data.msg ?? data.reason}`,
      data.reason,
      data.code
    )
  }

  /** List existing tags (public) — for idempotent tag seeding. */
  async listTags(): Promise<
    { slugName: string; displayName: string; originalText: string }[]
  > {
    const data = await this.request<
      AnswerEnvelope & {
        data: {
          list?: Array<{
            slug_name?: string
            display_name?: string
            original_text?: string
          }>
        }
      }
    >("/answer/api/v1/tags/page?page=1&page_size=100", { method: "GET" })
    if (data.code !== 200) {
      throw new AnswerError("Answer tag list failed", data.reason, data.code)
    }
    return (data.data?.list ?? []).map((tag) => ({
      slugName: tag.slug_name ?? "",
      displayName: tag.display_name ?? "",
      originalText: tag.original_text ?? "",
    }))
  }

  /** Create a tag (admin). Non-200 → AnswerError. */
  async createTag(input: {
    displayName: string
    originalText: string
    slugName: string
  }): Promise<void> {
    const token = await this.adminToken()
    const data = await this.request<AnswerEnvelope>("/answer/api/v1/tag", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: input.displayName,
        original_text: input.originalText,
        slug_name: input.slugName,
      }),
    })
    if (data.code !== 200) {
      throw new AnswerError(
        `Answer tag creation failed: ${data.msg ?? data.reason}`,
        data.reason,
        data.code
      )
    }
  }

  /**
   * Resolve an Answer user_id by username (or email) via the admin search.
   * Answer keys page items by `user_id` (newer) or `id` — handle both.
   */
  async resolveUserId(username: string): Promise<string | null> {
    const token = await this.adminToken()
    const data = await this.request<
      AnswerEnvelope & { data?: { list?: Array<Record<string, unknown>> } }
    >(`/answer/admin/api/users/page?query=${encodeURIComponent(username)}`, {
      method: "GET",
      headers: { Authorization: token },
    })
    if (data.code !== 200) {
      throw new AnswerError("Answer user search failed", data.reason, data.code)
    }
    const match = (data.data?.list ?? []).find(
      (item) => item.username === username || item.email === username
    )
    const id = match ? (match.user_id ?? match.id) : undefined
    return typeof id === "string" && id.length > 0 ? id : null
  }

  /** Reset a user's password (admin) — the deterministic submit-login path. */
  async resetUserPassword(userId: string, password: string): Promise<void> {
    const token = await this.adminToken()
    const data = await this.request<AnswerEnvelope>(
      "/answer/admin/api/user/password",
      {
        method: "PUT",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password }),
      }
    )
    if (data.code !== 200) {
      throw new AnswerError(
        `Answer password reset failed: ${data.msg ?? data.reason}`,
        data.reason,
        data.code
      )
    }
  }

  /**
   * Send the user their "set your password" email (admin). Idempotent.
   * Path note: the Swagger @Router annotation says `users/activation` (plural),
   * but the real gin route is `user/activation` (singular) — the plural path
   * returns the SPA HTML shell with 200 and never reaches the handler (verified
   * live 2026-09-04). Require the JSON envelope so a wrong path or a shell
   * response fails loudly instead of silently no-op'ing.
   */
  async activateUser(userId: string): Promise<void> {
    const token = await this.adminToken()
    const { status, body } = await this.requestRaw(
      "/answer/admin/api/user/activation",
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }
    )
    const envelope = body as AnswerEnvelope
    if (status < 200 || status >= 300 || envelope.code !== 200) {
      throw new AnswerError(
        `Answer user activation failed (http ${status}, code ${envelope.code ?? "?"})`,
        envelope.reason ?? `http ${status}`,
        status
      )
    }
  }

  /** User-scoped token via email login — used to create questions as the user. */
  async loginAsUser(email: string, password: string): Promise<string> {
    const data = await this.request<
      AnswerEnvelope & { data?: { access_token?: string } }
    >("/answer/api/v1/user/login/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e_mail: email, pass: password }),
    })
    if (data.code !== 200 || !data.data?.access_token) {
      throw new AnswerError("Answer user login failed", data.reason, data.code)
    }
    return data.data.access_token
  }

  /**
   * Create a question as the given user; returns the public question URL.
   * The user token is passed in (it is not admin-scoped).
   */
  async createQuestion(
    token: string,
    input: { title: string; content: string; tags: string[] }
  ): Promise<string> {
    const data = await this.request<AnswerEnvelope & { data?: object }>(
      "/answer/api/v1/question",
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          tags: input.tags.map((slugName) => ({
            display_name: slugName,
            original_text: slugName,
            slug_name: slugName,
          })),
        }),
      }
    )
    if (data.code !== 200 || !data.data) {
      throw new AnswerError(
        `Answer question creation failed: ${data.msg ?? data.reason}`,
        data.reason,
        data.code
      )
    }
    const created = data.data as { id?: unknown; question_id?: unknown }
    const id = created.id ?? created.question_id
    if (typeof id !== "string" || id.length === 0) {
      throw new AnswerError(
        "Answer question creation returned no id",
        data.reason,
        data.code
      )
    }
    return `${env.feedbackPublicUrl}/questions/${id}`
  }

  /**
   * Authenticated admin PUT (script tooling: SMTP + siteinfo configure).
   * Shared by `configure:feedback`; the concrete admin endpoints wrap it.
   */
  async adminPut(path: string, body: unknown): Promise<void> {
    const token = await this.adminToken()
    const data = await this.request<AnswerEnvelope>(path, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (data.code !== 200) {
      throw new AnswerError(
        `Answer admin request failed (${path}): ${data.msg ?? data.reason}`,
        data.reason,
        data.code
      )
    }
  }
}

/** Shared process client (token memoized per process). */
export const answerClient = new AnswerClient()
