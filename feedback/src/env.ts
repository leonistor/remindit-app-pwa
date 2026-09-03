// Env comes from the single root .env (D9), injected by the root scripts via
// `bun --env-file=../.env run <script>`. Every value has a dev-safe default so
// `bun test` and type-only consumers never need configuration.

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const env = {
  /** Apache Answer HTTP port (server.http.addr in conf/config.yaml). */
  port: positiveInt(process.env.FEEDBACK_PORT, 5555),
  /**
   * Pinned Answer release tag (without the `v` prefix). Empty = resolve the
   * latest GitHub release at setup time — kept pinned in .env.example so
   * local setups are reproducible.
   */
  version: process.env.FEEDBACK_VERSION ?? "2.0.2",
  /** Auto-install values (Answer AUTO_INSTALL env flow). */
  siteName: process.env.FEEDBACK_SITE_NAME ?? "RemindIt Feedback",
  siteUrl:
    process.env.FEEDBACK_SITE_URL ?? "https://feedback.remindit.localhost",
  contactEmail:
    process.env.FEEDBACK_CONTACT_EMAIL ?? "feedback-admin@remindit.local",
  adminName: process.env.FEEDBACK_ADMIN_NAME ?? "remindit_admin",
  adminEmail:
    process.env.FEEDBACK_ADMIN_EMAIL ?? "feedback-admin@remindit.local",
  adminPassword:
    process.env.FEEDBACK_ADMIN_PASSWORD ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("FEEDBACK_ADMIN_PASSWORD is required in production")
        })()
      : "change-me-dev-only"),
}
