import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import {
  authResponseSchema,
  loginBodySchema,
  registerBodySchema,
  userPublicSchema,
} from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth, SESSION_COOKIE, setSessionCookie } from "../middleware/auth"
import { authService } from "../services/auth"

// Auth is PB-stateless (JWT): register/login mint the token, logout is a
// cookie clear (clients additionally discard their stored token), and
// requireAuth rotates the token near expiry (header + cookie re-issue).
export const auth = new Hono<AppEnv>()
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
