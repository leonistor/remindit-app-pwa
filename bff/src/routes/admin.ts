// Admin routes (phase 6): role-guarded at the edge — requireAuth validates
// the session and the guard checks `record.role` server-side. Non-admins get
// 403 before any superuser-side query runs.

import { zValidator } from "@hono/zod-validator"
import { createMiddleware } from "hono/factory"
import { Hono } from "hono"
import { adminUserCreateBodySchema } from "../contracts"
import { requireAuth, type AppEnv } from "../middleware/auth"
import { adminService } from "../services/admin"

const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("auth").record.role !== "admin") {
    return c.json({ error: "admin role required" }, 403)
  }
  await next()
})

export const admin = new Hono<AppEnv>()
  .use(requireAuth)
  .use(requireAdmin)
  .get("/overview", async (c) => c.json(await adminService.overview()))
  .get("/users", async (c) => {
    const page = Number(c.req.query("page") ?? "1") || 1
    const perPage = Math.min(Number(c.req.query("perPage") ?? "50") || 50, 200)
    return c.json(await adminService.listUsers(page, perPage))
  })
  .post(
    "/users",
    zValidator("json", adminUserCreateBodySchema),
    async (c) => c.json(await adminService.createUser(c.req.valid("json")), 201),
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
