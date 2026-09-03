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

  private async request<T>(path: string, init: RequestInit): Promise<T> {
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
    const body = (await res.json().catch(() => ({}))) as T
    return body
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
}

/** Shared process client (token memoized per process). */
export const answerClient = new AnswerClient()
