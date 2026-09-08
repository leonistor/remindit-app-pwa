// Feedback service (phase 2): write-only bug/feature capture from the
// assistant. The submit runs on the caller's client — anonymous (shared `pb`)
// or the token-scoped client when attributed — and PB's createRule does the
// attribution check (`user = @request.auth.id`); the route resolves the
// userId from the validated token, never the body.
import type PocketBase from "pocketbase"
import type { Feedback, FeedbackSubmitBody } from "../contracts"
import { createFeedback } from "../repositories/feedback"

const toFeedback = (record: Record<string, unknown>): Feedback => ({
  id: record.id as string,
  kind: record.kind as "bug" | "feature",
  message: record.message as string,
  // Empty string on the wire (unset relation/text) normalizes to undefined.
  locale: (record.locale as string) || undefined,
  user: (record.user as string) || undefined,
  created: record.created as string | undefined,
  updated: record.updated as string | undefined,
})

export const feedbackService = {
  /** Write one feedback row; `userId` attributes it when a token was present. */
  async submit(
    client: PocketBase,
    body: FeedbackSubmitBody,
    userId?: string
  ): Promise<Feedback> {
    return toFeedback(
      await createFeedback(client, {
        kind: body.kind,
        message: body.message,
        locale: body.locale,
        ...(userId ? { user: userId } : {}),
      })
    )
  },
}