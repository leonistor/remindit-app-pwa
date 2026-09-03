// Feedback bridge service (one-way): new app user → Apache Answer user.
// Provisioning happens at registration (auth service hook) and via the
// backfill script for pre-existing users. No syncing: Answer is written once,
// never read back into app state beyond the stored `feedback_username` link.
// Deliberately non-fatal everywhere — a feedback outage must never break
// registration.
import { randomBytes } from "node:crypto"
import type { RecordModel } from "pocketbase"
import {
  type AnswerClient,
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
 * Throwaway password for the provisioned Answer user (defer-login decision:
 * credentials are never disclosed or stored — SSO/email-invite is a later
 * phase). Only constraint: satisfy Answer's password policy (8+ chars).
 */
export const throwawayPassword = (): string =>
  `${randomBytes(12).toString("base64url")}a1`

export type ProvisionOutcome = "created" | "exists" | "already-linked"

export const feedbackService = {
  /**
   * Ensure the PB user has an Answer-side user; store the linkage in
   * `feedback_username`. Idempotent at both ends (PB field set + Answer's
   * uniqueness guard). Returns the Answer username.
   *
   * `email` overrides `record.email` — PB hides the email on create responses
   * (emailVisibility defaults false), so the register hook passes the one it
   * just validated. The backfill (superuser client) sees emails as-is.
   */
  async ensureFeedbackUser(
    record: RecordModel,
    options: { client?: AnswerClient; email?: string } = {}
  ): Promise<{ username: string; outcome: ProvisionOutcome }> {
    if (record.feedback_username) {
      return {
        username: record.feedback_username as string,
        outcome: "already-linked",
      }
    }
    const username = sanitizeAnswerUsername(
      record.username as string,
      record.id as string
    )
    const outcome = await (options.client ?? answerClient).createUser({
      username,
      email: (options.email ?? record.email) as string,
      password: throwawayPassword(),
      displayName: (record.username as string) ?? username,
    })
    // Persist the linkage superuser-side (the field is hidden from the API).
    const pbAdmin = await forSuperuser()
    await pbAdmin
      .collection("users")
      .update(record.id, { feedback_username: username })
    return { username, outcome }
  },

  /** Fire-and-forget variant for the register hook — logs, never throws. */
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
}
