// Auth middleware (phase 3): validates a PB auth token (Bearer header, or the
// web session cookie) via PB's auth-refresh, and exposes a token-scoped PB
// client on the context — all downstream PB calls run under that user's API
// rules (the BFF never bypasses authorization for user-scoped operations).

import { getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import type PocketBase from "pocketbase"
import { env } from "../env"
import { forToken } from "../repositories/pocketbase"

/** Cookie name for web sessions (pwa uses Bearer tokens in localStorage). */
export const SESSION_COOKIE = "remindit_session"

export type AuthContext = {
  userId: string
  /** Refreshed token — pass through so clients can rotate theirs. */
  token: string
  /** PB client scoped to this user; every call is rule-evaluated as them. */
  client: PocketBase
  /** The validated user record (from the same auth-refresh round trip). */
  record: Record<string, unknown>
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

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerToken(c) ?? getCookie(c, SESSION_COOKIE)
  if (!token) {
    return c.json({ error: "authentication required" }, 401)
  }

  const client = forToken(token)
  try {
    // auth-refresh validates the token AND rotates it (PB tokens are
    // short-lived stateless JWTs; refreshing on each request keeps sessions
    // alive without a server-side session store).
    //
    // Raw fetch, not client.send(): the SDK only attaches the Authorization
    // header when authStore.isValid (which needs a record with an id we
    // don't have before this very call).
    const res = await fetch(
      `${env.pocketbaseUrl}/api/collections/users/auth-refresh`,
      { method: "POST", headers: { Authorization: token } }
    )
    if (!res.ok) return c.json({ error: "invalid or expired token" }, 401)
    const refreshed = (await res.json()) as {
      token: string
      record: { id: string }
    }
    client.authStore.save(refreshed.token, refreshed.record as never)
    c.set("auth", {
      userId: refreshed.record.id,
      token: refreshed.token,
      client,
      record: refreshed.record as unknown as Record<string, unknown>,
    })
  } catch {
    return c.json({ error: "invalid or expired token" }, 401)
  }

  await next()
})
