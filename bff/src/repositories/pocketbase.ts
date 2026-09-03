import PocketBase, { ClientResponseError } from "pocketbase"
import { env } from "../env"

// Server-side PocketBase client (D8): PB concerns live in the repository
// layer — routes and services reach PB only through this module (directly or
// via service methods), never by importing the SDK themselves.

/** Anonymous/admin-side client (shared process singleton). */
export const pb = new PocketBase(env.pocketbaseUrl)

// Auto-cancellation aborts identical in-flight requests when a new one fires —
// a browser-UX feature that is wrong for a long-lived server process.
pb.autoCancellation(false)

/**
 * Per-request client scoped to a user's PB auth token (phase 3): SDK calls
 * through it are evaluated against that user by PB's API rules — the BFF
 * never bypasses authorization for user-scoped operations.
 */
export const forToken = (token: string): PocketBase => {
  const client = new PocketBase(env.pocketbaseUrl)
  client.autoCancellation(false)
  // Payload is unknown until auth-refresh validates the token; only the token
  // itself matters for the Authorization header the SDK attaches.
  client.authStore.save(token, { id: "" } as never)
  return client
}

// --- session validation (phase 3 auth middleware) ----------------------------

/** PB rejected the presented token (or its record is gone) — session is dead. */
export class InvalidTokenError extends Error {
  constructor() {
    super("invalid or expired token")
  }
}

/**
 * PocketBase could not be reached or failed on its own side — a retryable
 * infra failure, not a credential problem (app.onError maps it to 503 so
 * clients keep their credentials instead of logging out on a PB blip).
 */
export class PocketBaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "PocketBase is temporarily unavailable, please retry",
      cause ? { cause } : undefined
    )
  }
}

const pbFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(`${env.pocketbaseUrl}${path}`, init)
  } catch (cause) {
    // fetch throws only on network-level failures (refused/unreachable);
    // HTTP error statuses still come back as a Response.
    throw new PocketBaseUnavailableError(cause)
  }
}

/** Typed session errors are shaped once in app.onError (lib/pb-error.ts). */
const assertSessionUsable = (
  status: number,
  invalidStatuses: number[]
): void => {
  if (invalidStatuses.includes(status)) throw new InvalidTokenError()
  if (status >= 400) throw new PocketBaseUnavailableError()
}

/**
 * Validate + rotate a user token via PB's auth-refresh: PB checks the JWT
 * signature and returns a fresh token plus the validated record. The only
 * transport-level auth validation the BFF performs — everything else is
 * delegated to PB's API rules on the token-scoped client.
 */
export const authRefresh = async (
  token: string
): Promise<{ token: string; record: Record<string, unknown> }> => {
  const res = await pbFetch("/api/collections/users/auth-refresh", {
    method: "POST",
    headers: { Authorization: token },
  })
  assertSessionUsable(res.status, [400, 401])
  return (await res.json()) as {
    token: string
    record: Record<string, unknown>
  }
}

/**
 * Authenticated read of the user record — backs `AuthContext.record` on the
 * fresh-token fast path, where the middleware itself makes no PB calls.
 */
export const fetchAuthedRecord = async (
  token: string,
  id: string
): Promise<Record<string, unknown>> => {
  const res = await pbFetch(`/api/collections/users/records/${id}`, {
    headers: { Authorization: token },
  })
  assertSessionUsable(res.status, [400, 401, 404])
  return (await res.json()) as Record<string, unknown>
}

// --- superuser client (cached singleton, single-flight re-auth) --------------

/** Cached superuser client — one per process, token re-authed in place. */
const superuser = new PocketBase(env.pocketbaseUrl)
superuser.autoCancellation(false)

let superuserAuth: Promise<void> | undefined

const superuserCredentials = (): { email: string; password: string } => {
  const email = env.pocketbaseAdminEmail
  const password = env.pocketbaseAdminPassword
  if (!email || !password) {
    throw new Error("POCKETBASE_ADMIN_EMAIL/PASSWORD missing in the root .env")
  }
  return { email, password }
}

const authSuperuser = async (): Promise<void> => {
  const { email, password } = superuserCredentials()
  await superuser.collection("_superusers").authWithPassword(email, password)
}

/**
 * Single-flight auth: concurrent callers share one in-flight password login
 * instead of stampeding PB with N parallel ones. The settled promise is
 * dropped so a later 401 can force a fresh attempt, and a still-valid token
 * short-circuits (the SDK's isValid already inspects the JWT expiry).
 */
const ensureSuperuserAuth = (): Promise<void> => {
  if (superuser.authStore.isValid) return Promise.resolve()
  superuserAuth ??= authSuperuser().finally(() => {
    superuserAuth = undefined
  })
  return superuserAuth
}

const reauthSuperuser = (): Promise<void> => {
  // A token invalidated server-side (or rotated away) can still look valid
  // to the SDK — clear it so the single-flight auth actually runs.
  superuser.authStore.clear()
  return ensureSuperuserAuth()
}

/**
 * Run `op` superuser-side with 401 self-healing: an expired or invalidated
 * superuser token triggers exactly one re-auth (single-flight, shared with
 * concurrent 401 hits) and the op is retried once. Retry is deliberately
 * 401-only — 403/404/5xx are real results, not recoverable auth state.
 * `op` must be a single PB request or otherwise safe to run twice.
 */
export const withSuperuser = async <T>(
  op: (client: PocketBase) => Promise<T>
): Promise<T> => {
  await ensureSuperuserAuth()
  try {
    return await op(superuser)
  } catch (error) {
    // Network failures surface as ClientResponseError with status 0 —
    // also excluded here, so only PB's own 401 re-auths.
    if (!(error instanceof ClientResponseError) || error.status !== 401) {
      throw error
    }
    await reauthSuperuser()
    return await op(superuser)
  }
}

/**
 * Cached superuser client (admin-side ops only — migrations, test fixtures,
 * backfill scripts). Kept for callers that need the client itself; service
 * code should prefer {@link withSuperuser} to get the 401 self-healing.
 */
export const forSuperuser = async (): Promise<PocketBase> => {
  await ensureSuperuserAuth()
  return superuser
}
