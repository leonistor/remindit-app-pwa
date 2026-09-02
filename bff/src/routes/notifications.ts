import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { notificationMarkReadBodySchema } from "../contracts"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { notificationsService } from "../services/notifications"

// Stub surface (D4): list + mark-read only. Dispatch (channel + creation)
// arrives in phase 5+ once the notification channel is decided.
export const notifications = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    return c.json(await notificationsService.list(c.get("auth").client))
  })
  .patch(
    "/:id",
    zValidator("json", notificationMarkReadBodySchema),
    async (c) => {
      const { id } = c.req.param()
      const { read } = c.req.valid("json")
      return c.json(
        await notificationsService.markRead(c.get("auth").client, id, read)
      )
    }
  )
