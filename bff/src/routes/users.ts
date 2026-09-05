import { Hono } from "hono"
import { userLookupQuerySchema, userPublicSchema } from "../contracts"
import { validatedQuery } from "../lib/validation"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { usersService } from "../services/users"

// Username → userId resolution for the group-invite flow. Auth-only: the
// `users` listRule permits any authenticated user to read profiles; the BFF
// shapes the payload (email masked to "" by contract) and never widens
// access (D8).
//
// Response-validation policy (item 8): every contract-shaped response is
// `.parse`d through its schema (see routes/groups.ts).
export const users = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/lookup", validatedQuery(userLookupQuerySchema), async (c) => {
    const { username } = c.req.valid("query")
    const user = await usersService.lookup(c.get("auth").client, username)
    if (!user) {
      return c.json({ error: "user not found" }, 404)
    }
    return c.json(userPublicSchema.parse(user))
  })
