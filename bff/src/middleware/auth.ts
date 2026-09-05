// Auth middleware (phase 3): validates the PB auth token (Bearer header, or
// the web session cookie) and exposes a token-scoped PB client on the context
// — all downstream PB calls run under that user's API rules (the BFF never
// bypasses authorization for user-scoped operations).
//
// Session lifecycle: the token's JWT claims are decoded locally. Fresh tokens
// take a zero-PB-round-trip fast path; near-expiry tokens go through PB
// auth-refresh, which validates the signature and rotates the token — the
// fresh token is then delivered back to the client (X-Session-Token header,
// cookie re-issue) so stateless sessions outlive the original TTL.
//
// Transport note: both Bearer and cookie paths are SHIPPED and tested, but the
// cookie path currently has NO consumer — pwa + admin authenticate with Bearer
// only. It is RESERVED for the web module's SSR auth (HttpOnly cookies are the
// right transport for a server-rendered origin; localStorage/Bearer is not
// available to the SSR render). Keep both until web auth lands.

import type { Context } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import type PocketBase from "pocketbase"
import { env } from "../env"
import {
  authRefresh,
  fetchAuthedRecord,
  forToken,
} from "../repositories/pocketbase"

/** Cookie name for web sessions (pwa uses Bearer tokens in localStorage). */
export const SESSION_COOKIE = "remindit_session"

const SESSION_MAX_AGE = 14 * 24 * 60 * 60

/** Re-issue the session cookie — login/register, and rotation for cookie sessions. */
export const setSessionCookie = (c: Context, token: string): void => {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.sessionCookieSecure,
    maxAge: SESSION_MAX_AGE,
  })
}

export type AuthContext = {
  userId: string
  token: string
  /** PB client scoped to this user; every call is rule-evaluated as them. */
  client: PocketBase
  /**
   * Validated user record, resolved on demand: the fresh-token fast path
   * makes no PB calls, so consumers that need record fields (admin guard,
   * /api/auth/me) pay one authenticated record read — memoized per request —
   * while the token-scoped hot path (client + token only) pays nothing.
   */
  record: () => Promise<Record<string, unknown>>
}

export type AppEnv = {
  Variables: { auth: AuthContext }
}

const bearerToken = (c: {
  req: { header: (name: string) => string | undefined }
}): string | undefined => {
  const header = c.req.header("authorization")
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined
}

// --- local JWT decoding (no signature check on the fast path) ----------------

/** Claims the BFF cares about; `recordId` is the newer PB spelling of `id`. */
export type JwtClaims = {
  exp?: number
  iat?: number
  id?: string
  recordId?: string
}

/** Decode a JWT payload (base64url JSON). Returns null for non-JWT input. */
export const decodeJwtPayload = (token: string): JwtClaims | null => {
  const part = token.split(".")[1]
  if (!part) return null
  try {
    return JSON.parse(
      new TextDecoder().decode(Buffer.from(part, "base64url"))
    ) as JwtClaims
  } catch {
    return null
  }
}

// Refresh when <20% of the token's original lifetime remains (≈2.8 days on
// PB's default 14-day TTL): infrequent enough to skip the round trip on the
// hot path, early enough that background rotation never lets a session lapse.
const REFRESH_RATIO = 0.2
// Tokens without a usable iat/exp span fall back to a 48h rotation window.
const FALLBACK_LIFETIME_S = 48 * 60 * 60

/** True when the token is near expiry or its claims can't establish validity. */
export const shouldRotate = (
  claims: JwtClaims,
  nowS = Math.floor(Date.now() / 1000)
): boolean => {
  const { exp, iat } = claims
  if (typeof exp !== "number" || !Number.isFinite(exp)) return true
  const lifetime =
    typeof iat === "number" && Number.isFinite(iat) && iat > 0 && exp > iat
      ? exp - iat
      : FALLBACK_LIFETIME_S
  return exp - nowS < REFRESH_RATIO * lifetime
}

const claimsUserId = (claims: JwtClaims): string | undefined => {
  const id = claims.id ?? claims.recordId
  return typeof id === "string" && id.length > 0 ? id : undefined
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const bearer = bearerToken(c)
  const token = bearer ?? getCookie(c, SESSION_COOKIE)
  if (!token) {
    return c.json({ error: "authentication required" }, 401)
  }

  const claims = decodeJwtPayload(token)
  const claimedId = claims && claimsUserId(claims)

  if (claims && claimedId && !shouldRotate(claims)) {
    // Fast path: no PB round trip. Signature is intentionally NOT verified
    // here — PB re-validates the token on every upstream call (services and
    // the /pb forwarder stamp this exact token), so a forged token fails
    // closed at the first data call; exp/iat are only trusted as a rotation
    // heuristic because the signature covers them.
    const client = forToken(token)
    // Memoized so multiple consumers in one request share a single PB read.
    let recordPromise: Promise<Record<string, unknown>> | undefined
    const loadRecord = (): Promise<Record<string, unknown>> =>
      (recordPromise ??= fetchAuthedRecord(token, claimedId))
    c.set("auth", {
      userId: claimedId,
      token,
      client,
      record: loadRecord,
    })
    await next()
    return
  }

  // Near expiry (or undecodable claims): PB validates the signature and
  // rotates the token. authRefresh throws typed errors that app.onError
  // shapes — 401 for rejected tokens, 503 for a PB outage.
  const refreshed = await authRefresh(token)
  const client = forToken(refreshed.token)
  c.set("auth", {
    userId: String(refreshed.record.id),
    token: refreshed.token,
    client,
    record: async () => refreshed.record,
  })
  await next()

  // Deliver the rotation only after the response exists: c.header()/
  // setCookie() mutate the finalized response, which also covers the /pb
  // forwarder's raw Response returns (headers prepared before next() would
  // be dropped for those).
  c.header("X-Session-Token", refreshed.token)
  if (bearer === undefined) {
    setSessionCookie(c, refreshed.token)
  }
})
