// Typed BFF RPC client (fetch-based) for the account-level endpoints the pwa
// uses (phase 5). Data-plane CRUD goes through the PB SDK pointed at the
// /pb/* forwarder instead (see stores/sync + docs/SYNC.md).
//
// The request/response shapes mirror `bff/src/contracts.ts` (zod-tested over
// there). They are duplicated here deliberately: importing the BFF package at
// runtime would drag the whole server graph into the client bundle, and a
// type-only import would still need the dependency installed for tsc. Keep
// the two in sync — the BFF side is the source of truth.

const base = () =>
  (import.meta.env?.PUBLIC_BFF_URL as string | undefined) ??
  "http://127.0.0.1:3100"

export type UserPublic = {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  avatar: string
}

export type AuthResponse = { token: string; user: UserPublic }

export type Group = {
  id: string
  name: string
  owner: string
  created?: string
  updated?: string
}

export type MemberRole = "owner" | "member"

export type Notification = {
  id: string
  type: string
  payload?: unknown
  read: boolean
  user: string
  group?: string
}

export class BffError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "BffError"
    this.status = status
    this.details = details
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = init
  const res = await fetch(`${base()}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  })
  if (!res.ok) {
    let message = res.statusText
    let details: unknown
    try {
      const body = (await res.json()) as { error?: string; details?: unknown }
      message = body.error ?? message
      details = body.details
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new BffError(res.status, message, details)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const bffApi = {
  register: (body: {
    email: string
    password: string
    passwordConfirm: string
    username: string
    firstName?: string
    lastName?: string
  }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) =>
    request<UserPublic>("/api/auth/me", { method: "GET", token }),

  createGroup: (token: string, name: string) =>
    request<Group>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
      token,
    }),

  listGroups: (token: string) =>
    request<Group[]>("/api/groups", { method: "GET", token }),

  listNotifications: (token: string) =>
    request<Notification[]>("/api/notifications", { method: "GET", token }),
}
