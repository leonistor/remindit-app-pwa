import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import { rateLimiter } from "hono-rate-limiter"
import {
  authResponseSchema,
  loginBodySchema,
  registerBodySchema,
  userPublicSchema,
} from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth, SESSION_COOKIE, setSessionCookie } from "../middleware/auth"
import { authService } from "../services/auth"

// Rate limit: 20 attempts per 15 minutes per IP.
// Protects against brute-force login and registration amplification
// (register fans out to the Answer sidecar).
const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (c) =>
    c.req.header("x-forwarded-for") ??
    c.req.header("x-real-ip") ??
    "unknown",
})

// Auth is PB-stateless (JWT): register/login mint the token, logout is a
// cookie clear (clients additionally discard their stored token), and
// requireAuth rotates the token near expiry (header + cookie re-issue).
export const auth = new Hono<AppEnv>()
  .use("*", authRateLimiter)
  .post("/register", validatedJson(registerBodySchema), async (c) => {
    const result = await authService.register(c.req.valid("json"))
    setSessionCookie(c, result.token)
    return c.json(authResponseSchema.parse(result), 201)
  })
  .post("/login", validatedJson(loginBodySchema), async (c) => {
    const result = await authService.login(c.req.valid("json"))
    setSessionCookie(c, result.token)
    return c.json(authResponseSchema.parse(result))
  })
  .post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    return c.body(null, 204)
  })
  .get("/me", requireAuth, async (c) =>
    c.json(userPublicSchema.parse(await authService.me(c.get("auth"))))
  )
