// Admin routes (phase 6): role-guarded at the edge — requireAuth validates
// the session and the guard checks `record.role` server-side. Non-admins get
// 403 before any superuser-side query runs.

import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { adminUserCreateBodySchema } from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { adminService } from "../services/admin"

const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  // record is resolved on demand (fresh-token fast path) — the admin guard is
  // one of the consumers that needs it, so this pays one PB record read.
  if ((await c.get("auth").record()).role !== "admin") {
    return c.json({ error: "admin role required" }, 403)
  }
  await next()
})

const adminListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
  filter: z.string().optional(),
})

export const admin = new Hono<AppEnv>()
  .use(requireAuth)
  .use(requireAdmin)
  .get("/overview", async (c) => c.json(await adminService.overview()))
  .get("/users", async (c) => {
    const { page, perPage, filter } = adminListQuerySchema.parse(c.req.query())
    return c.json(await adminService.listUsers(page, perPage, filter))
  })
  .post("/users", validatedJson(adminUserCreateBodySchema), async (c) =>
    c.json(await adminService.createUser(c.req.valid("json")), 201)
  )
  .delete("/users/:id", async (c) => {
    if (c.req.param("id") === c.get("auth").userId) {
      return c.json({ error: "cannot delete your own account" }, 400)
    }
    await adminService.deleteUser(c.req.param("id"))
    return c.body(null, 204)
  })
  .get("/groups", async (c) => c.json(await adminService.listGroups()))
  .delete("/groups/:id", async (c) => {
    await adminService.deleteGroup(c.req.param("id"))
    return c.body(null, 204)
  })
