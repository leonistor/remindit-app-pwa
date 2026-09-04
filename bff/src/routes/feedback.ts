import { Hono } from "hono"
import type { Context } from "hono"
import { rateLimiter } from "hono-rate-limiter"
import type { RecordModel } from "pocketbase"
import {
  feedbackGuestBodySchema,
  feedbackResponseSchema,
  feedbackSubmitBodySchema,
} from "../contracts"
import { validatedJson } from "../lib/validation"
import { type AppEnv, requireAuth } from "../middleware/auth"
import { AnswerError, AnswerUnavailableError } from "../repositories/answer"
import { feedbackService } from "../services/feedback"

// Rate limit: 10 per 15 minutes per IP. Feedback is a slow, manual action and
// must not be an amplification vector (each submit fans out to the Answer
// sidecar; the guest route is anonymous).
const feedbackRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (c) =>
    c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
})

// Answer is a dependency of this explicit action (unlike registration, where
// provisioning is non-fatal): map its failures to distinct statuses so the
// client can act on them. Unknown errors rethrow to the app-level onError.
const answerErrorResponse = (c: Context<AppEnv>, error: unknown): Response => {
  if (error instanceof AnswerUnavailableError) {
    return c.json({ error: "feedback unavailable" }, 503)
  }
  if (error instanceof AnswerError) {
    return c.json({ error: error.message }, 502)
  }
  throw error
}

export const feedback = new Hono<AppEnv>()
  .use("*", feedbackRateLimiter)
  .post(
    "/",
    requireAuth,
    validatedJson(feedbackSubmitBodySchema),
    async (c) => {
      const record = await c.get("auth").record()
      try {
        const result = await feedbackService.submitFeedback({
          kind: "user",
          record: record as RecordModel,
          ...c.req.valid("json"),
        })
        return c.json(feedbackResponseSchema.parse(result), 201)
      } catch (error) {
        return answerErrorResponse(c, error)
      }
    }
  )
  .post("/guest", validatedJson(feedbackGuestBodySchema), async (c) => {
    try {
      const result = await feedbackService.submitFeedback({
        kind: "guest",
        ...c.req.valid("json"),
      })
      return c.json(feedbackResponseSchema.parse(result), 201)
    } catch (error) {
      return answerErrorResponse(c, error)
    }
  })
  .post("/activate", requireAuth, async (c) => {
    const record = await c.get("auth").record()
    try {
      await feedbackService.activateLogin(record as RecordModel)
      return c.body(null, 204)
    } catch (error) {
      return answerErrorResponse(c, error)
    }
  })
