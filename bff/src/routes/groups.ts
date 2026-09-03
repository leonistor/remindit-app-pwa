import { Hono } from "hono"
import { groupCreateBodySchema, memberInviteBodySchema } from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { groupsService } from "../services/groups"

// All group routes require auth; authorization itself (owner ∨ member) is
// enforced by PB API rules on the token-scoped client (D8) — the BFF shapes
// payloads and never widens access.
export const groups = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    return c.json(await groupsService.list(c.get("auth").client))
  })
  .post("/", validatedJson(groupCreateBodySchema), async (c) => {
    const { name } = c.req.valid("json")
    const { userId, client } = c.get("auth")
    return c.json(await groupsService.create(client, userId, name), 201)
  })
  .get("/:id", async (c) => {
    return c.json(
      await groupsService.get(c.get("auth").client, c.req.param("id"))
    )
  })
  .delete("/:id", async (c) => {
    await groupsService.remove(c.get("auth").client, c.req.param("id"))
    return c.body(null, 204)
  })
  .get("/:id/members", async (c) => {
    return c.json(
      await groupsService.listMembers(c.get("auth").client, c.req.param("id"))
    )
  })
  .post("/:id/members", validatedJson(memberInviteBodySchema), async (c) => {
    const { id } = c.req.param()
    return c.json(
      await groupsService.invite(c.get("auth").client, id, c.req.valid("json")),
      201
    )
  })
  .delete("/:id/members/:memberId", async (c) => {
    await groupsService.removeMember(
      c.get("auth").client,
      c.req.param("memberId")
    )
    return c.body(null, 204)
  })
