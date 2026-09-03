// Admin API client + session storage (phase 6). Mirrors the BFF admin
// contracts (bff/src/contracts.ts — the source of truth); Bearer-token auth
// like the pwa (the session cookie is HttpOnly on the BFF origin and the
// admin runs on its own origin, so localStorage + Bearer is the simplest
// correct transport for a standalone admin tool).

const TOKEN_KEY = "remindit-admin-token"

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

const base = () =>
  (import.meta.env?.PUBLIC_BFF_URL as string | undefined) ??
  "http://127.0.0.1:3100"

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
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

// --- mirrored BFF contract types (keep in sync with bff/src/contracts.ts) ---

export type UserRole = "user" | "admin"

export type AdminOverview = {
  users: number
  groups: number
  items: number
  listEntries: number
  historyEvents: number
}

export type AdminUser = {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  avatar: string
  role: UserRole
  created?: string
  updated?: string
}

export type AdminGroup = {
  id: string
  name: string
  owner: string
  ownerUsername?: string
  membersCount: number
  created?: string
  updated?: string
}
