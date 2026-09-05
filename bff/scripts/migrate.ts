// Reconcile the live PocketBase schema towards `src/schema/collections.ts`
// (D7). Thin entry over `src/schema/reconcile.ts` (the testable engine):
// health-check, superuser bootstrap, run the reconcile, print the action log.
// Never deletes: per collection — create if missing, patch if the
// canonicalized definition drifted, skip when unchanged. Running twice in a
// row must report everything "unchanged" (the phase-2 idempotency gate).
//
// Run through the root script (`bun run migrate:bff`) so the root .env is
// loaded (D9). Requires PocketBase to be running (`bun run dev:bff`).

import { resolve } from "node:path"
import PocketBase from "pocketbase"
import { env } from "../src/env"
import { reconcileSchema } from "../src/schema/reconcile"

const bffDir = resolve(import.meta.dir, "..")

// --- superuser bootstrap ----------------------------------------------------
// Auth as the dev superuser; when the account doesn't exist yet, provision it
// via the pinned pocketbase-bin CLI (same creds from the root .env).

async function ensureSuperuser(pb: PocketBase): Promise<void> {
  const email = env.pocketbaseAdminEmail
  const password = env.pocketbaseAdminPassword
  if (!email || !password) {
    console.error(
      "[migrate] POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD missing in the root .env"
    )
    process.exit(1)
  }
  try {
    await pb.collection("_superusers").authWithPassword(email, password)
    return
  } catch {
    console.log("[migrate] superuser not found — provisioning via CLI…")
  }
  const proc = Bun.spawnSync({
    cmd: [
      "bunx",
      "@fadlee/pocketbase-bin",
      "superuser",
      "upsert",
      email,
      password,
    ],
    cwd: bffDir,
    stdout: "inherit",
    stderr: "inherit",
  })
  if (proc.exitCode !== 0) {
    console.error("[migrate] superuser provisioning failed")
    process.exit(1)
  }
  await pb.collection("_superusers").authWithPassword(email, password)
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const pb = new PocketBase(env.pocketbaseUrl)
  pb.autoCancellation(false)

  try {
    await fetch(`${env.pocketbaseUrl}/api/health`)
  } catch {
    console.error(
      `[migrate] PocketBase is not reachable at ${env.pocketbaseUrl} — start it with \`bun run dev:bff\``
    )
    process.exit(1)
  }

  await ensureSuperuser(pb)

  const actions = await reconcileSchema(pb, {
    promoteAdminEmail: env.pocketbaseAdminEmail,
  })

  for (const action of actions) console.log(`  ${action}`)
  const changed = actions.filter((a) => !a.startsWith("unchanged")).length
  console.log(
    changed === 0
      ? `✓ schema in sync with src/schema/collections.ts (${actions.length} collections, no changes)`
      : `✓ schema reconciled (${changed} change${changed === 1 ? "" : "s"} out of ${actions.length} collections)`
  )
}

main().catch((error) => {
  // PB validation errors carry per-field details in error.response.data —
  // surface them verbosely, the collapsed SDK message is useless.
  const response = (error as { response?: { data?: unknown } }).response
  if (response) {
    console.error(
      "[migrate] PB error response:",
      JSON.stringify(response, null, 2)
    )
  }
  console.error("[migrate] failed:", error)
  process.exit(1)
})