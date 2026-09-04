// Typed BFF RPC client (fetch-based) for the account-level endpoints the pwa
// uses (phase 5). Data-plane CRUD goes through the PB SDK pointed at the
// /pb/* forwarder instead (see stores/sync + docs/SYNC.md).
//
// The request/response shapes mirror `bff/src/contracts.ts` (zod-tested over
// there). They are duplicated here deliberately: importing the BFF package at
// runtime would drag the whole server graph into the client bundle, and a
// type-only import would still need the dependency installed for tsc. Keep
// the two in sync — the BFF side is the source of truth.

import { DEFAULT_BFF_URL } from "./sync-constants"

const base = () =>
  (import.meta.env?.PUBLIC_BFF_URL as string | undefined) ?? DEFAULT_BFF_URL

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

export type Member = {
  id: string
  role: MemberRole
  group: string
  user: UserPublic
}

export type Notification = {
  id: string
  type: string
  payload?: unknown
  read: boolean
  user: string
  group?: string
}

// Feedback (FB3) — the community-board (Apache Answer) surfaces. `FeedbackTag`
// and `FeedbackResponse` mirror bff/src/contracts.ts; see the file header for
// the duplication rationale.
export type FeedbackTag = "bug" | "feature-request" | "discussion"

export type FeedbackResponse = { questionUrl: string }

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

// --- token rotation capture -------------------------------------------------

type RotatedTokenHandler = (token: string) => void

let rotatedTokenHandler: RotatedTokenHandler | null = null

/**
 * Registers the handler invoked when an authenticated response carries a
 * rotated session token (`X-Session-Token` header — the BFF's auth middleware
 * delivers the auth-refreshed token there when the near-expiry fast path
 * misses). Layering: this lib must not import stores, so the direction is
 * stores → lib — the sync engine injects its session-patching handler at
 * module init. Pass `null` to unregister.
 */
export function setRotatedTokenHandler(
  handler: RotatedTokenHandler | null
): void {
  rotatedTokenHandler = handler
}

/** Absent handler (lib used without the sync engine) → quiet no-op. */
function notifyRotatedToken(res: Response): void {
  const token = res.headers.get("X-Session-Token")
  if (token && rotatedTokenHandler) rotatedTokenHandler(token)
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = init
  // Merge caller-provided signal with a 30 s timeout so stalled BFF
  // requests don't hang the UI indefinitely.
  const existingSignal = rest.signal
  const timeoutSignal = AbortSignal.timeout(30_000)
  const signal = existingSignal
    ? AbortSignal.any([existingSignal, timeoutSignal])
    : timeoutSignal
  const res = await fetch(`${base()}${path}`, {
    ...rest,
    signal,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  })
  // Read before the ok-check: the header only rides validated-session
  // responses, but consuming it unconditionally costs nothing and the
  // engine-side capture no-ops unless the token actually changed.
  notifyRotatedToken(res)
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

  lookupUser: (token: string, username: string) =>
    request<UserPublic>(
      `/api/users/lookup?username=${encodeURIComponent(username)}`,
      { method: "GET", token }
    ),

  createGroup: (token: string, name: string) =>
    request<Group>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
      token,
    }),

  listGroups: (token: string) =>
    request<Group[]>("/api/groups", { method: "GET", token }),

  listMembers: (token: string, groupId: string) =>
    request<Member[]>(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "GET",
      token,
    }),

  // Role is fixed to "member" for V5: only owners may grant "owner" later.
  inviteMember: (token: string, groupId: string, userId: string) =>
    request<Member>(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      body: JSON.stringify({ userId, role: "member" }),
      token,
    }),

  removeMember: (token: string, groupId: string, memberId: string) =>
    request<void>(
      `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE", token }
    ),

  listNotifications: (token: string) =>
    request<Notification[]>("/api/notifications", { method: "GET", token }),

  // Per-id mark-read (no mark-all endpoint): PATCH { read: true }. The
  // response body (updated row) is ignored by the client — the store applies
  // its own optimistic update.
  markNotificationRead: (token: string, id: string) =>
    request<void>(`/api/notifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
      token,
    }),

  // The PWA is the only module that posts feedback for now, so fromModule is
  // pinned here rather than taken from the caller.
  submitFeedback: (
    token: string,
    body: { subject: string; text: string; tag: FeedbackTag; route?: string }
  ) =>
    request<FeedbackResponse>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ ...body, fromModule: "pwa" }),
      token,
    }),

  // Triggers the "set your password" email on the Answer side; answers 204
  // with an empty body, hence request<void>.
  activateFeedbackLogin: (token: string) =>
    request<void>("/api/feedback/activate", { method: "POST", token }),
}
