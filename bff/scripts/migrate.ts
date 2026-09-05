// Reconcile the live PocketBase schema towards `src/schema/collections.ts`
// (D7). Never deletes: per collection — create if missing, patch if the
// canonicalized definition drifted, skip when unchanged. Running twice in a
// row must report everything "unchanged" (the phase-2 idempotency gate).
//
// Run through the root script (`bun run migrate:bff`) so the root .env is
// loaded (D9). Requires PocketBase to be running (`bun run dev:bff`).

import { resolve } from "node:path"
import PocketBase from "pocketbase"
import { env } from "../src/env"
import {
  type CollectionDef,
  desiredCollections,
  type FieldDef,
} from "../src/schema/collections"

const bffDir = resolve(import.meta.dir, "..")

// --- canonical diff ---------------------------------------------------------
// Both sides are reduced to the keys we manage, with server-managed keys
// (`id`, `system`) stripped recursively and object keys sorted — so a stable
// string compare is enough. Field definitions in the builders are written in
// full, which is what makes this converge (no "default value" drift).

// Keys PB manages server-side: strip from BOTH sides of the diff. `help` /
// `primaryKey` are per-field server noise (we don't manage them — help text
// stays whatever PB/ADMIN UI holds); `id`/`system` are record/field identity.
const SERVER_NOISE_KEYS = new Set(["id", "system", "help", "primaryKey"])

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SERVER_NOISE_KEYS.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonicalize(v)])
    )
  }
  return value
}

const MANAGED_KEYS = [
  "type",
  "viewQuery",
  "fields",
  "listRule",
  "viewRule",
  "createRule",
  "updateRule",
  "deleteRule",
  "indexes",
  "passwordAuth",
] as const

// Per-type managed keys: views get their fields auto-derived by PB from the
// query (never managed) and don't support indexes; base/auth never carry a
// viewQuery. viewQuery itself IS managed for views.
const managedKeysFor = (type: unknown): readonly string[] =>
  MANAGED_KEYS.filter((key) =>
    type === "view"
      ? key !== "fields" && key !== "indexes"
      : key !== "viewQuery"
  )

const managedView = (collection: Record<string, unknown>): string =>
  JSON.stringify(
    Object.fromEntries(
      managedKeysFor(collection.type).map((key) => {
        let value = collection[key] ?? null
        // PB stores the view query verbatim — compare whitespace-insensitively
        // so reformatting the SQL in the builders stays a no-op.
        if (key === "viewQuery" && typeof value === "string") {
          value = value.replace(/\s+/g, " ").trim()
        }
        // Exclude PB-managed fields (the PK "id" plus every field flagged
        // `system` — auth collections carry several, e.g. password/email).
        if (key === "fields" && Array.isArray(value)) {
          value = value.filter((f) => {
            const field = f as { name?: string; system?: boolean } | null
            return field?.name !== "id" && field?.system !== true
          })
        }
        // Exclude PB's internal auth-collection indexes (system fields like
        // tokenKey/email) — they carry PB's internal users collection marker.
        if (key === "indexes" && Array.isArray(value)) {
          value = value.filter(
            (sql) => typeof sql !== "string" || !sql.includes("_pb_users_auth_")
          )
        }
        return [key, canonicalize(value)]
      })
    )
  )

// Relations reference collections by NAME in the builders (ids only exist at
// runtime); resolve to the wire-format `collectionId` here.
const toWireFields = (
  fields: FieldDef[],
  nameToId: Map<string, string>
): Record<string, unknown>[] =>
  fields.map((field) => {
    if (field.type !== "relation") return { ...field }
    const id = field.collectionName
      ? nameToId.get(field.collectionName)
      : undefined
    if (!id) {
      throw new Error(
        `relation "${field.name}" targets "${field.collectionName}" which is not defined yet (check collection order)`
      )
    }
    const { collectionName: _drop, ...wire } = field
    return { ...wire, collectionId: id }
  })

// View builders must carry their query — PB derives the fields from it.
const requireViewQuery = (def: CollectionDef): string => {
  if (!def.viewQuery) {
    throw new Error(`view "${def.name}" is missing viewQuery`)
  }
  return def.viewQuery
}

// Id to send for an incoming field: the live field's id when the TYPE matches,
// undefined otherwise. PB refuses type changes on an existing field id (e.g. a
// fresh install's default users.avatar is a file field, ours is text) — an
// id-less field lets PB rebuild the column instead. Safe before views exist
// (Pass C); converged installs have no type drift, so they keep their ids.
const wireFieldId = (
  current: Record<string, unknown>,
  field: Record<string, unknown>
): Record<string, unknown> => {
  const name = field.name as string
  const live = (
    (current.fields as Array<{ name?: string; type?: string }> | undefined) ??
    []
  ).find((f) => f.name === name)
  const id =
    live && live.type === field.type ? (live as { id?: string }).id : undefined
  return id ? { ...field, id } : field
}

// Current fields reduced to the managed shape (PB-managed `id`/`system` fields
// excluded — same filter as managedView's) for drift comparison.
const managedCurrentFields = (current: Record<string, unknown>): unknown =>
  canonicalize(
    (
      (current.fields as
        | Array<{ name?: string; system?: boolean }>
        | undefined) ?? []
    ).filter((field) => field.name !== "id" && field.system !== true)
  )

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

  const existing = await pb.collections.getFullList()
  const nameToId = new Map(existing.map((c) => [c.name, c.id]))
  const byName = new Map<string, Record<string, unknown>>(
    existing.map((c) => [c.name, c as unknown as Record<string, unknown>])
  )

  const actions: string[] = []
  const fullPayload = (
    def: CollectionDef,
    fields: Record<string, unknown>[]
  ) =>
    def.type === "view"
      ? {
          name: def.name,
          type: def.type,
          viewQuery: requireViewQuery(def),
          listRule: def.listRule ?? null,
          viewRule: def.viewRule ?? null,
          // Views are read-only — mutation rules are always null.
          createRule: null,
          updateRule: null,
          deleteRule: null,
        }
      : {
          name: def.name,
          type: def.type,
          fields,
          listRule: def.listRule ?? null,
          viewRule: def.viewRule ?? null,
          createRule: def.createRule ?? null,
          updateRule: def.updateRule ?? null,
          deleteRule: def.deleteRule ?? null,
          indexes: def.indexes ?? [],
          ...(def.passwordAuth ? { passwordAuth: def.passwordAuth } : {}),
        }

  // Pass A — base structure: create missing NON-view collections WITHOUT
  // rules. Rules reference other collections by name (@collection.*), and PB
  // validates them at definition time, so all collections must exist before
  // any rule is written. Relations only point backwards, so fields are safe
  // here. Views are deferred to Pass C (see there).
  for (const def of desiredCollections) {
    if (def.type === "view" || byName.has(def.name)) continue
    const created = await pb.collections.create({
      name: def.name,
      type: def.type,
      fields: toWireFields(def.fields, nameToId),
    })
    nameToId.set(def.name, created.id)
    byName.set(def.name, created as unknown as Record<string, unknown>)
    actions.push(`created  ${def.name}`)
  }

  // Pass B — existing-collection field drift, BEFORE any view is created. On
  // a fresh install PB bootstraps its own default `users` auth collection
  // (which has no `username` column in PB ≥0.23, and a file-typed avatar),
  // and a view's query is validated by executing it at save time — so every
  // referenced column must exist first. Structure only: rules may reference
  // collections that don't exist yet (Pass D writes them), and indexes stay
  // Pass D's business.
  for (const def of desiredCollections) {
    if (def.type === "view") continue
    const current = byName.get(def.name)
    if (!current) continue
    const wireFields = toWireFields(def.fields, nameToId).map((field) =>
      wireFieldId(current, field)
    )
    if (
      JSON.stringify(managedCurrentFields(current)) ===
      JSON.stringify(canonicalize(wireFields))
    ) {
      continue
    }
    await pb.collections.update(def.name, { fields: wireFields })
    actions.push(`patched  ${def.name} (fields)`)
  }

  // Pass C — view structure: PB derives and validates the fields from the
  // query at save time, so every queried table/column must exist by now
  // (Pass A + Pass B guarantee that).
  for (const def of desiredCollections) {
    if (def.type !== "view" || byName.has(def.name)) continue
    const created = await pb.collections.create({
      name: def.name,
      type: def.type,
      viewQuery: requireViewQuery(def),
    })
    nameToId.set(def.name, created.id)
    byName.set(def.name, created as unknown as Record<string, unknown>)
    actions.push(`created  ${def.name}`)
  }

  // Pass D — reconcile definitions: rules, indexes, remaining field drift,
  // auth opts.
  for (const def of desiredCollections) {
    const current = byName.get(def.name)
    if (!current) {
      throw new Error(
        `collection "${def.name}" vanished between passes — rerun the migration`
      )
    }

    // Inject live field ids into the patch payload via wireFieldId (matched
    // by name AND type — see there): PB's field sync treats id-less incoming
    // fields as rebuild candidates (column drop+recreate), which fails
    // whenever a view pins those columns. Sending ids (like the dashboard
    // does) keeps unchanged columns in place; the canonical diff is
    // unaffected (ids are stripped as server noise on both sides).
    const wireFields = toWireFields(def.fields, nameToId).map((field) =>
      wireFieldId(current, field)
    )

    const managed = managedView(fullPayload(def, wireFields))

    if (managedView(current) === managed) {
      actions.push(`unchanged ${def.name}`)
      continue
    }

    // Partial patch — PB merges, so only managed keys change. Log which
    // managed keys diverged so schema drift stays explainable.
    const desiredCanonical = managedView(fullPayload(def, wireFields))
    const currentCanonical = managedView(current)
    const diffKeys = managedKeysFor(def.type).filter((key) => {
      const a = JSON.parse(desiredCanonical)[key]
      const b = JSON.parse(currentCanonical)[key]
      return JSON.stringify(a) !== JSON.stringify(b)
    })
    console.log(
      `    (diff in: ${diffKeys.join(", ")}` +
        diffKeys
          .map((key) => {
            const a = JSON.parse(desiredCanonical)[key]
            const b = JSON.parse(currentCanonical)[key]
            return `\n      ${key} desired: ${JSON.stringify(a)?.slice(0, 500)}\n      ${key} current: ${JSON.stringify(b)?.slice(0, 500)}`
          })
          .join("") +
        `\n    )`
    )

    // Partial patch — PB merges, so only managed keys change.
    const { name: _name, type: _type, ...patch } = fullPayload(def, wireFields)
    await pb.collections.update(def.name, patch)
    actions.push(`patched  ${def.name}`)
  }

  // Role bootstrap (phase 6): the user matching POCKETBASE_ADMIN_EMAIL (if
  // registered) becomes the first admin — idempotent.
  if (env.pocketbaseAdminEmail) {
    try {
      const adminUser = await pb.collection("users").getFirstListItem(
        pb.filter("email = {:email}", {
          email: env.pocketbaseAdminEmail,
        })
      )
      if (adminUser.role !== "admin") {
        await pb.collection("users").update(adminUser.id, { role: "admin" })
        actions.push(
          `patched  users (role bootstrap: ${env.pocketbaseAdminEmail} → admin)`
        )
      }
    } catch {
      // No such registered user yet — nothing to promote.
    }
  }

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
