// Admin API client + session storage (phase 6). Bearer-token auth
// like the pwa (the session cookie is HttpOnly on the BFF origin and the
// admin runs on its own origin, so localStorage + Bearer is the simplest
// correct transport for a standalone admin tool).
//
// Contract types come from `@remindit/bff/api` (the zod-only contracts
// module) as type-only imports — the BFF contracts file is the source of truth.

export type {
  AdminGroup,
  AdminOverview,
  AdminUser,
  AdminUserCreateBody,
  AdminUserPage,
  UserRole,
} from "@remindit/bff/api"

const TOKEN_KEY = "remindit-admin-token"

// Timeout guard: without it a hung BFF left every button pending forever.
// 10s rather than web's 5s — web's fetch is a best-effort public stats probe
// that should degrade fast, while these are interactive admin CRUD calls
// against a local BFF+PB where each mutation is followed by a list reload.
const REQUEST_TIMEOUT_MS = 10_000

// SSR-safe: TanStack Start executes beforeLoad + render on the server where
// localStorage is undefined — report "not signed in" there instead of
// crashing renderToReadableStream.
export const getToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)

export const setToken = (token: string): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = (): void => {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

export class AdminApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
  }
}

// Env convention (P10): Rsbuild inlines PUBLIC_* at build time via
// `import.meta.env` — never `process.env` (dot-access is not replaced by
// the Rsbuild plugin, so a non-local build silently falls back to
// localhost). web/src/lib/stats.ts is the reference idiom.
const base = () => import.meta.env?.PUBLIC_BFF_URL ?? "http://127.0.0.1:3100"

// Error bodies are usually a string, but BFF validation failures arrive as
// Zod issue arrays — format them as "field: message" so the UI never shows
// "[object Object]" from an object coerced into Error's string message.
const errorBodyToMessage = (value: unknown, fallback: string): string => {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .map((issue) => {
        if (typeof issue !== "object" || issue === null) return String(issue)
        const { path, message } = issue as { path?: unknown; message?: unknown }
        const field = Array.isArray(path) ? path.join(".") : ""
        const text =
          typeof message === "string" ? message : JSON.stringify(issue)
        return field ? `${field}: ${text}` : text
      })
      .join("; ")
  }
  if (value === undefined || value === null) return fallback
  return JSON.stringify(value)
}

// fetch rejects with a DOMException when the abort signal fires: "TimeoutError"
// in browsers (the abort reason of AbortSignal.timeout) or "AbortError" with a
// TimeoutError cause under Node/undici fetch. Plain "AbortError" without a
// TimeoutError cause is a caller-supplied signal firing — rethrown untouched.
const isTimeoutError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  if (err.name === "TimeoutError") return true
  if (err.name !== "AbortError") return false
  const cause = (err as { cause?: unknown }).cause
  return cause instanceof Error && cause.name === "TimeoutError"
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  // No current caller passes a signal; if one ever does, combine rather than
  // clobber so a caller abort isn't silently swallowed by the timeout signal.
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init?.signal
    ? AbortSignal.any([timeoutSignal, init.signal])
    : timeoutSignal
  let res: Response
  try {
    res = await fetch(`${base()}${path}`, {
      ...init,
      signal,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (cause) {
    // Surface as AdminApiError so pages render it uniformly instead of
    // leaking a DOMException; 408 (Request Timeout) is the semantically
    // correct status for a client-side timeout and can't collide with a
    // real BFF response (the request never got one).
    if (isTimeoutError(cause)) {
      throw new AdminApiError(
        408,
        `request timed out after ${REQUEST_TIMEOUT_MS / 1000}s — BFF unreachable or hung (${path})`
      )
    }
    throw cause
  }
  if (res.status === 401) {
    clearToken()
    // A 401 with a token attached means the session expired: bounce to /login
    // via a full-page load so the nav's signed-in links (derived from token
    // presence) reset too — a hook-based redirect would leave them stale.
    // Without a token it's a failed sign-in attempt on the login page, where
    // the thrown error must render instead of a silent redirect.
    if (token && typeof window !== "undefined") {
      window.location.assign("/login")
    }
    throw new AdminApiError(401, "session expired — sign in again")
  }
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: unknown }
      message = errorBodyToMessage(body.error, message)
    } catch {
      // non-JSON error body
    }
    throw new AdminApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
