// Feedback bridge service (one-way): new app user → Apache Answer user.
// Provisioning happens at registration (auth service hook), via the backfill
// script for pre-existing users, and lazily at submit/activate. No syncing:
// Answer is written once, never read back into app state beyond the stored
// `feedback_username` link. Registration provisioning is deliberately
// non-fatal — a feedback outage must never break registration — but the
// explicit submit/activate actions propagate errors (their routes map them).
import { createHmac } from "node:crypto"
import type { RecordModel } from "pocketbase"
import type {
  FeedbackFromModule,
  FeedbackResponse,
  FeedbackTag,
} from "../contracts"
import { env } from "../env"
import {
  type AnswerClient,
  AnswerError,
  AnswerUnavailableError,
  answerClient,
} from "../repositories/answer"
import { forSuperuser } from "../repositories/pocketbase"

/**
 * Map an app username onto Answer's username normalization (Answer slugifies
 * on save: lowercase, underscores → dashes — observed on this instance).
 * When a userId is provided, the last 4 chars are appended as a salt to
 * prevent case-colliding usernames from mislinking Answer accounts.
 */
export const sanitizeAnswerUsername = (
  input: string,
  userId?: string
): string => {
  const slug = input.toLowerCase().replaceAll("_", "-").slice(0, 24)
  if (userId) {
    const salt = userId.slice(-4)
    return `${slug}-${salt}`
  }
  return slug
}

/**
 * The Answer username Answer actually stores. Verified live: Answer IGNORES
 * the `username` field on user creation and derives the name from
 * `display_name` — lowercasing it and replacing spaces with dashes, while
 * PRESERVING underscores ("Foo_Bar Baz_UPPER" → "foo_bar-baz_upper",
 * "Brave_Otter_42" → "brave_otter_42", "  Two  Spaces  " → "--two--spaces--").
 *
 * This deliberately does NOT reuse `sanitizeAnswerUsername`'s underscore→dash
 * rule (that was a wrong assumption — Answer keeps underscores). Our
 * createUser passes displayName = record.username, so the canonical name is
 * slug(record.username) — and it must not carry the userId salt (the salted
 * value was written to feedback_username but never matched Answer's stored
 * name, breaking resolve-by-username).
 */
export const canonicalAnswerUsername = (username: string): string =>
  username.toLowerCase().replaceAll(" ", "-")

/**
 * Deterministic per-user password for the Answer twin, derived from the
 * bridge secret (HMAC-SHA256 of `answer:<username>`). Deterministic because
 * submitFeedback must re-derive the same credential to log the twin in later
 * (Answer never stores app-chosen passwords); the secret keeps it unguessable.
 *
 * Deviation note: base64url SHA-256 is 43 chars, over Answer's admin cap —
 * both add-user and password-reset schemas enforce `gte=8,lte=32` (verified
 * in Answer's backyard_user_schema.go). Truncate to 32 so admin calls accept
 * it; the `<8` guard is kept for spec fidelity (base64url can't hit it).
 */
export const deriveAnswerPassword = (username: string): string => {
  const digest = createHmac("sha256", env.answerBridgeSecret)
    .update(`answer:${username}`)
    .digest("base64url")
  const password = digest.length < 8 ? `${digest}a1` : digest
  return password.slice(0, 32)
}

export type ProvisionOutcome = "created" | "exists" | "already-linked"

export const feedbackService = {
  /**
   * Ensure the PB user has an Answer-side user; store the linkage in
   * `feedback_username`. Idempotent at both ends (PB field set + Answer's
   * uniqueness guard). Returns the canonical Answer username — the stored
   * `feedback_username` from a legacy row may hold the salted value Answer
   * never used, so resolution must recompute the canonical name (see
   * submitFeedback/activateLogin), not trust the returned/linked string.
   *
   * `email` overrides `record.email` — PB hides the email on create responses
   * (emailVisibility defaults false), so the register hook passes the one it
   * just validated. The backfill (superuser client) sees emails as-is.
   */
  async ensureFeedbackUser(
    record: RecordModel,
    options: { client?: AnswerClient; email?: string } = {}
  ): Promise<{ username: string; outcome: ProvisionOutcome }> {
    // Answer stores slug(display_name); displayName is record.username, so the
    // canonical name is slug(record.username) — never the salted variant.
    const username = canonicalAnswerUsername(record.username as string)
    if (record.feedback_username) {
      return { username, outcome: "already-linked" }
    }
    const outcome = await (options.client ?? answerClient).createUser({
      username,
      email: (options.email ?? record.email) as string,
      password: deriveAnswerPassword(username),
      displayName: (record.username as string) ?? username,
    })
    // Persist the linkage superuser-side (the field is hidden from the API).
    const pbAdmin = await forSuperuser()
    await pbAdmin
      .collection("users")
      .update(record.id, { feedback_username: username })
    return { username, outcome }
  },

  /**
   * Fire-and-forget variant for the register hook — logs, never throws.
   */
  async provisionQuietly(
    record: RecordModel,
    options: { email?: string } = {}
  ): Promise<void> {
    // Test kill-switch: the integration suites register throwaway users and
    // must not mint Answer twins on every run (bff "test" script sets it).
    if (process.env.FEEDBACK_BRIDGE === "off") return
    try {
      const { username, outcome } = await this.ensureFeedbackUser(
        record,
        options
      )
      console.log(`[feedback] provisioned ${username} (${outcome})`)
    } catch (error) {
      // Expected when the sidecar is down — registration proceeds regardless.
      const reason =
        error instanceof AnswerUnavailableError ? "unreachable" : "rejected"
      console.warn(
        `[feedback] provisioning skipped (${reason}) for ${record.username}:`,
        error
      )
    }
  },

  /**
   * Submit feedback as a question on the Answer sidecar. Supports an
   * authenticated user (PB record + module context) or an anonymous guest
   * (shared `web-guest` twin, no PB linkage). Errors propagate — this is the
   * explicit submit action, so Answer failures surface to the route.
   */
  async submitFeedback(
    input:
      | {
          kind: "user"
          record: RecordModel
          fromModule: FeedbackFromModule
          route?: string | undefined
          subject: string
          text: string
          tag: FeedbackTag
        }
      | {
          kind: "guest"
          subject: string
          text: string
          tag: FeedbackTag
          contactEmail?: string
        },
    options: { client?: AnswerClient } = {}
  ): Promise<FeedbackResponse> {
    const client = options.client ?? answerClient

    let username: string
    let email: string
    let displayName: string
    let fromModule: FeedbackFromModule
    let route: string | undefined
    let contactEmail: string | undefined

    if (input.kind === "user") {
      // Ensure the twin exists + linkage stored. Resolution below recomputes
      // the canonical name — a stored feedback_username from a legacy row may
      // hold the salted value Answer never used, so it is not trusted.
      await this.ensureFeedbackUser(input.record, {
        client,
        email: input.record.email as string,
      })
      username = canonicalAnswerUsername(input.record.username as string)
      email = input.record.email as string
      displayName = (input.record.username as string) ?? username
      fromModule = input.fromModule
      route = input.route
    } else {
      username = "web-guest"
      email = env.feedbackGuestEmail
      displayName = "Web guest"
      fromModule = "web"
      route = undefined
      contactEmail = input.contactEmail
    }

    const password = deriveAnswerPassword(username)
    // Idempotency safety net: resolve the twin, provisioning it first if the
    // search can't find it (e.g. Answer's search lag or a wiped twin).
    let userId = await client.resolveUserId(username)
    if (userId === null) {
      await client.createUser({
        username,
        email,
        password,
        displayName,
      })
      userId = await client.resolveUserId(username)
      if (userId === null) {
        // Do not proceed with a null id — the reset would 400. Fail loudly.
        throw new AnswerError(
          `Answer user ${username} could not be resolved after provisioning`,
          "user.resolve_failed",
          400
        )
      }
    }
    // Reset ensures the stored password matches what we derive, then log in
    // as the user to mint the question-scoped token.
    await client.resetUserPassword(userId, password)
    const token = await client.loginAsUser(email, password)

    const content =
      `${input.text}\n\n---\n` +
      `*from: ${fromModule}${route ? `, route: ${route}` : ""}` +
      `${contactEmail ? `, contact: ${contactEmail}` : ""}*`
    const questionUrl = await client.createQuestion(token, {
      title: input.subject,
      content,
      tags: [input.tag],
    })
    return { questionUrl }
  },

  /**
   * (Re)send the user their Answer "set your password" email. Resolves the
   * twin by the recomputed canonical username (the stored feedback_username
   * from a legacy row may hold the salted value Answer never used) and
   * activates it. Idempotent: a missing twin is a no-op. Answer
   * unreachability surfaces as AnswerUnavailableError (route maps it to 503).
   */
  async activateLogin(
    record: RecordModel,
    options: { client?: AnswerClient } = {}
  ): Promise<void> {
    const client = options.client ?? answerClient
    const username = canonicalAnswerUsername(record.username as string)
    const userId = await client.resolveUserId(username)
    if (userId === null) {
      // Twin not provisioned yet — nothing to activate (idempotent no-op).
      console.warn(`[feedback] activate: no twin for ${username}, skipping`)
      return
    }
    await client.activateUser(userId)
  },
}
