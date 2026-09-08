import { Hono } from "hono"
import { feedbackSchema, feedbackSubmitBodySchema } from "../contracts"
import { validatedJson } from "../lib/validation"
import {
  type AppEnv,
  type AuthContext,
  optionalAuth,
} from "../middleware/auth"
import { pb } from "../repositories/pocketbase"
import { feedbackService } from "../services/feedback"

// Write-only feedback capture (phase 2): the assistant reports bugs/features
// here. Attribution to a signed-in user is OPTIONAL — optionalAuth sets
// `auth` only when a Bearer token was present, and the route attributes from
// the validated token's claimed id, never the body. The collection's
// list/view/update/delete rules are superuser-only (null), so this is the
// only write path. Response-validation policy (item 8): the created record
// is `.parse`d through feedbackSchema.
export const feedback = new Hono<AppEnv>()
  .use(optionalAuth)
  .post("/", validatedJson(feedbackSubmitBodySchema), async (c) => {
    const body = c.req.valid("json")
    // `auth` is set only when a token was present; the shared anonymous
    // client covers the no-token case.
    const auth = c.get("auth") as AuthContext | undefined
    const client = auth?.client ?? pb
    return c.json(
      feedbackSchema.parse(
        await feedbackService.submit(client, body, auth?.userId)
      ),
      201
    )
  })