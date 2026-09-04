// Configure the Answer sidecar (Apache Answer, admin API) for the feedback
// slice — one idempotent script. Subcommands (default: all):
//   bun run configure:feedback [tags|smtp|branding]
// Reads before writes where cheap, and every write is safe to repeat.
import { BRAND_COLOR, BRAND_NAME } from "@remindit/common/brand"
import { env } from "../src/env"
import { answerClient } from "../src/repositories/answer"

const subcommand = process.argv[2] ?? "all"

// Seed tag specs — descriptions mirror docs/FEEDBACK.md (the source of truth).
const SEED_TAGS: { slugName: string; description: string }[] = [
  {
    slugName: "bug",
    description:
      "Something isn't working that you believe is due to a mistake, malfunction, or programming error.",
  },
  {
    slugName: "feature-request",
    description:
      "For proposals of new features on the software, or requests for a change to an existing feature.",
  },
  {
    slugName: "discussion",
    description:
      "For questions that may not necessarily have a clear-cut right or wrong answer.",
  },
  { slugName: "development", description: "Questions about development." },
]

/** "feature-request" → "Feature request" (Answer's display_name style). */
const humanName = (slug: string): string =>
  slug
    .replaceAll("-", " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ")

const configureTags = async (): Promise<void> => {
  const existing = await answerClient.listTags()
  const bySlug = new Set(existing.map((tag) => tag.slugName))
  for (const tag of SEED_TAGS) {
    if (bySlug.has(tag.slugName)) {
      console.log(`[tags] ${tag.slugName}: exists, skipping`)
      continue
    }
    await answerClient.createTag({
      slugName: tag.slugName,
      displayName: humanName(tag.slugName),
      originalText: tag.description,
    })
    console.log(`[tags] ${tag.slugName}: created`)
  }
}

const configureSmtp = async (): Promise<void> => {
  const { host, from, port, user, password, fromName, encryption } = env.smtp
  if (!host || !from) {
    console.error(
      "[smtp] SMTP_HOST and SMTP_FROM are required in the root .env (bff section)"
    )
    process.exit(1)
  }
  await answerClient.adminPut("/answer/admin/api/setting/smtp", {
    smtp_authentication: Boolean(user),
    encryption,
    from_email: from,
    from_name: fromName,
    smtp_host: host,
    smtp_password: password,
    smtp_port: port,
    smtp_username: user,
    ...(env.smtpTestEmail ? { test_email_recipient: env.smtpTestEmail } : {}),
  })
  console.log(`[smtp] configured (host=${host}, from=${from})`)
}

const configureBranding = async (): Promise<void> => {
  await answerClient.adminPut("/answer/admin/api/siteinfo/general", {
    name: BRAND_NAME,
    site_url: env.feedbackPublicUrl,
    contact_email: env.answerAdminEmail,
    short_description:
      "RemindIt user feedback — bug reports, feature requests and discussions.",
    description:
      "Share feedback about RemindIt: report a bug, request a feature, or start a discussion.",
  })
  await answerClient.adminPut("/answer/admin/api/siteinfo/theme", {
    theme: "default",
    theme_config: { primary_color: BRAND_COLOR },
  })
  // Custom CSS: accent links/buttons with the brand color. The CSS/HTML
  // endpoints accept long inline strings (unlike the branding image APIs).
  await answerClient.adminPut("/answer/admin/api/siteinfo/custom-css-html", {
    custom_css:
      `a { color: ${BRAND_COLOR}; }\n` +
      `.btn-primary { background-color: ${BRAND_COLOR}; border-color: ${BRAND_COLOR}; }`,
  })
  console.log("[branding] site identity + theme configured")
  console.log(
    "[branding] NOTE: the logo image cannot be set via the API — its ~4 KB SVG " +
      "exceeds the 512-char URL limit — upload it manually in the Answer Admin " +
      "UI (or via a hosted URL later)."
  )
}

const main = async (): Promise<void> => {
  switch (subcommand) {
    case "tags":
      await configureTags()
      break
    case "smtp":
      await configureSmtp()
      break
    case "branding":
      await configureBranding()
      break
    case "all":
      await configureTags()
      await configureSmtp()
      await configureBranding()
      break
    default:
      console.error(
        `[configure:feedback] unknown subcommand: ${subcommand} (expected tags|smtp|branding)`
      )
      process.exit(1)
  }
}

main().catch((error) => {
  console.error("[configure:feedback] failed:", error)
  process.exit(1)
})
