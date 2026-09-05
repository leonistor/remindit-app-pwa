import { Hono } from "hono"
import {
  notificationMarkReadBodySchema,
  notificationSchema,
} from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { notificationsService } from "../services/notifications"

// Stub surface (D4): list + mark-read only. Dispatch (channel + creation)
// arrives in phase 5+ once the notification channel is decided.
//
// Response-validation policy (item 8): every contract-shaped response is
// `.parse`d through its schema (see routes/groups.ts).
export const notifications = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const items = await notificationsService.list(c.get("auth").client)
    return c.json(items.map((item) => notificationSchema.parse(item)))
  })
  .patch("/:id", validatedJson(notificationMarkReadBodySchema), async (c) => {
    const { id } = c.req.param()
    const { read } = c.req.valid("json")
    return c.json(
      notificationSchema.parse(
        await notificationsService.markRead(c.get("auth").client, id, read)
      )
    )
  })
