// Platform seed CLI — writes the curated demo dataset (users + teams +
// shopping content + history + notifications) into PocketBase, idempotently.
//
// Run through the root script (`bun run seed:bff`) so the root .env is loaded
// (D9). Requires PocketBase to be running (`bun run dev:bff`). Dev/demo only:
// refuses to run when NODE_ENV=production — the prod VPS carries real users.
//
// The core logic lives in `src/seeds/seed.ts` (testable); this file is the
// env-facing thin wrapper (health pre-check, superuser client, summary print).

import { loadPlatformSeed } from "@remindit/common/seeds"
import { env } from "../src/env"
import { forSuperuser } from "../src/repositories/pocketbase"
import { seedPlatform } from "../src/seeds/seed"

if (process.env.NODE_ENV === "production") {
  console.error(
    "[seed] refusing to seed a production PocketBase — the platform seed is dev/demo only"
  )
  process.exit(1)
}

async function main(): Promise<void> {
  try {
    await fetch(`${env.pocketbaseUrl}/api/health`)
  } catch {
    console.error(
      `[seed] PocketBase is not reachable at ${env.pocketbaseUrl} — start it with \`bun run dev:bff\``
    )
    process.exit(1)
  }

  const dataset = loadPlatformSeed()
  const pb = await forSuperuser()
  const summary = await seedPlatform(pb, dataset)

  const { created, existing, content } = summary
  console.log(
    `✓ platform seed applied (${created.users.length} users created, ` +
      `${existing.users.length} existing; ${created.teams.length} teams created, ` +
      `${existing.teams.length} existing)`
  )
  if (created.users.length > 0) {
    console.log(`  users: ${created.users.join(", ")}`)
  }
  if (created.teams.length > 0) {
    console.log(`  teams: ${created.teams.join(", ")}`)
  }
  if (created.members.length > 0) {
    console.log(`  members added: ${created.members.join(", ")}`)
  }
  console.log(
    `  content: ${content.categories} categories, ${content.items} items, ` +
      `${content.listEntries} list entries, ${content.historyEvents} history events`
  )
  console.log(`  notifications: ${summary.notifications}`)
  console.log(`  demo password for every seed user: "${dataset.password}"`)
}

main().catch((error) => {
  console.error("[seed] failed:", error)
  process.exit(1)
})