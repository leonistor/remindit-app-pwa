// One-time live migration: `groups` → `teams` (+ `group_members` →
// `team_members`, relation field `group` → `team`). See docs/SCHEMA.md
// ("Rename migration"). Idempotent/resumable: every step checks current
// state, so re-running after a mid-flight failure finishes the job.
//
// Why the reconcile script can't do this: it matches collections by NAME and
// never deletes, so a rename would read as "create teams, keep groups" with
// the data stranded in the old table. Ordering constraints discovered live:
//   - PB validates a collection's rules AND indexes against the schema at
//     every save → rules/indexes referencing the old names must be
//     neutralized BEFORE any rename (the reconcile rewrites them after).
//   - PB re-validates a VIEW's stored viewQuery at every save, and SQLite
//     table renames do NOT update PB's stored query strings → view
//     delete/rename fails once the underlying tables are renamed. The views
//     must therefore be dropped FIRST, while their queries still validate.
//     (Views hold no records, so dropping is lossless; the reconcile
//     recreates them under the new team_* names.)
//
// Run from the repo root (D9 env injection):
//   cd bff && bun --env-file=../.env scripts/rename-groups-to-teams.ts
// Then reconcile:
//   bun run migrate:bff   # twice; second run must be a no-op

import PocketBase from "pocketbase"
import { env } from "../src/env"

// [from, to] — PB renames the SQLite tables in place (data preserved;
// relation targets are collectionIds).
const RENAMED_COLLECTIONS: Array<[string, string]> = [
  ["group_members", "team_members"],
  ["groups", "teams"],
]

// Collections carrying a `group` relation field → renamed to `team`
// (same field id, so PB issues a column rename, keeping all rows). Looked up
// by NEW name first (post-rename resumption), falling back to the old name.
const FIELD_RENAME_COLLECTIONS: Array<[string, string]> = [
  ["team_members", "group_members"],
  ["categories", "categories"],
  ["items", "items"],
  ["list_entries", "list_entries"],
  ["history_events", "history_events"],
  ["notifications", "notifications"],
]

// Rules/indexes referencing the old names would fail PB's save-time
// validation and be runtime-broken after it — neutralize first.
const RULE_RESET_COLLECTIONS = [
  "groups",
  "group_members",
  "categories",
  "items",
  "list_entries",
  "history_events",
  "group_member_details",
  "group_details",
  "list_entries_detailed",
  "category_stats",
  "item_stats",
]
const DROP_INDEX_COLLECTIONS = [
  "group_members",
  "categories",
  "items",
  "list_entries",
  "history_events",
]

// MUST happen before the table renames (see header note).
const VIEWS_TO_DELETE = ["group_member_details", "group_details"]

async function main(): Promise<void> {
  const pb = new PocketBase(env.pocketbaseUrl)
  pb.autoCancellation(false)

  try {
    await fetch(`${env.pocketbaseUrl}/api/health`)
  } catch {
    console.error(
      `[rename] PocketBase is not reachable at ${env.pocketbaseUrl} — start it with \`bun run dev:bff\``
    )
    process.exit(1)
  }

  const email = env.pocketbaseAdminEmail
  const password = env.pocketbaseAdminPassword
  if (!email || !password) {
    console.error(
      "[rename] POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD missing in the root .env"
    )
    process.exit(1)
  }
  await pb.collection("_superusers").authWithPassword(email, password)

  const existing = await pb.collections.getFullList()
  const names = new Set(existing.map((c) => c.name))
  const has = (name: string) => names.has(name)

  if (!has("groups") && !has("group_member_details") && !has("group_details")) {
    console.log("[rename] nothing left to migrate — already done")
    return
  }
  if (has("groups") && has("teams")) {
    console.error(
      "[rename] both `groups` and `teams` exist — manual intervention required"
    )
    process.exit(1)
  }

  for (const name of RULE_RESET_COLLECTIONS) {
    if (!has(name)) continue
    await pb.collections.update(name, {
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    })
  }
  for (const name of DROP_INDEX_COLLECTIONS) {
    if (!has(name)) continue
    await pb.collections.update(name, { indexes: [] })
  }
  console.log("[rename] rules nulled + indexes dropped on affected collections")

  for (const name of VIEWS_TO_DELETE) {
    if (!has(name)) continue
    try {
      await pb.collections.delete(name)
      console.log(
        `[rename] deleted view ${name} (recreated as team_* by the reconcile)`
      )
    } catch {
      // Post-rename partial state: the stored query references tables that no
      // longer exist, so PB refuses the save. Recoverable only by patching
      // the view to a valid query (then delete/rename) — surface it loudly.
      console.error(
        `[rename] could not delete view ${name} — its stored viewQuery no longer validates (rename the view manually, e.g. PATCH {name, viewQuery} with team_* SQL), continuing`
      )
    }
  }

  for (const [from, to] of RENAMED_COLLECTIONS) {
    if (!has(from)) continue
    await pb.collections.update(from, { name: to })
    console.log(`[rename] collection ${from} → ${to}`)
  }

  for (const [newName, oldName] of FIELD_RENAME_COLLECTIONS) {
    const target = has(newName) ? newName : has(oldName) ? oldName : null
    if (!target) continue
    const collection = await pb.collections.getOne(target)
    const fields = (
      collection as unknown as { fields: Array<Record<string, unknown>> }
    ).fields
    if (!fields.some((field) => field.name === "group")) continue
    await pb.collections.update(target, {
      fields: fields.map((field) =>
        field.name === "group" ? { ...field, name: "team" } : field
      ),
    })
    console.log(`[rename] field group → team on ${target}`)
  }

  console.log(
    "[rename] done — now run `bun run migrate:bff` twice (second run must be a no-op)"
  )
}

main().catch((error) => {
  // PB validation errors carry per-field details in error.response.data.
  const response = (error as { response?: { data?: unknown } }).response
  if (response) {
    console.error(
      "[rename] PB error response:",
      JSON.stringify(response, null, 2)
    )
  }
  console.error("[rename] failed:", error)
  process.exit(1)
})
