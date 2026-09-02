import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import {
  authResponseSchema,
  loginBodySchema,
  registerBodySchema,
  userPublicSchema,
} from "../contracts"
import { env } from "../env"
import { type AppEnv, requireAuth, SESSION_COOKIE } from "../middleware/auth"
import { authService } from "../services/auth"

// Mirrors PB's default auth token TTL (14 days).
const SESSION_MAX_AGE = 14 * 24 * 60 * 60

const setSession = (
  c: Parameters<typeof setCookie>[0],
  token: string
): void => {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.sessionCookieSecure,
    maxAge: SESSION_MAX_AGE,
  })
}

// Auth is PB-stateless (JWT): register/login mint the token, logout is a
// cookie clear (clients additionally discard their stored token), and every
// request re-validates + rotates the token via auth-refresh (requireAuth).
export const auth = new Hono<AppEnv>()
  .post("/register", zValidator("json", registerBodySchema), async (c) => {
    const result = await authService.register(c.req.valid("json"))
    setSession(c, result.token)
    return c.json(authResponseSchema.parse(result), 201)
  })
  .post("/login", zValidator("json", loginBodySchema), async (c) => {
    const result = await authService.login(c.req.valid("json"))
    setSession(c, result.token)
    return c.json(authResponseSchema.parse(result))
  })
  .post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    return c.body(null, 204)
  })
  .get("/me", requireAuth, (c) =>
    c.json(userPublicSchema.parse(authService.me(c.get("auth"))))
  )
