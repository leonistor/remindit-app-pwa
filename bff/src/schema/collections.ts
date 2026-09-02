// Desired-state PocketBase schema (D7): the single source of truth for the
// served PB collections, derived from `@remindit/common` domain types.
//
// The migrate script (scripts/migrate.ts) reconciles the live PB schema
// towards THIS definition — per collection create/patch, never delete. Field
// definitions are therefore written in full (every option the wire format
// carries, in its desired value) so that a canonicalized diff against the
// live schema converges: second run ⇒ everything "unchanged".
//
// Mapping table + rules rationale live in bff/docs/SCHEMA.md (kept in sync
// with this file).

import { CATEGORY_FREQUENCIES, UNCATEGORIZED_NAME } from "@remindit/common"

export type FieldDef = {
  type:
    | "text"
    | "number"
    | "bool"
    | "email"
    | "select"
    | "relation"
    | "json"
    | "autodate"
  name: string
  required?: boolean
  hidden?: boolean
  presentable?: boolean
  /** text */
  min?: number
  max?: number
  pattern?: string
  autogeneratePattern?: string
  /** number */
  onlyInt?: boolean
  /** email */
  exceptDomains?: string[]
  onlyDomains?: string[]
  /** select */
  values?: string[]
  maxSelect?: number
  /** relation — resolved to collectionId by the migrate script (by name) */
  collectionName?: string
  cascadeDelete?: boolean
  minSelect?: number
  /** json */
  maxSize?: number
  /** autodate */
  onCreate?: boolean
  onUpdate?: boolean
  [key: string]: unknown
}

export type CollectionDef = {
  name: string
  type: "base" | "auth"
  fields: FieldDef[]
  /** PB rule semantics: "" = anyone (incl. anon), null/undefined = nobody (superuser only) */
  listRule?: string | null
  viewRule?: string | null
  createRule?: string | null
  updateRule?: string | null
  deleteRule?: string | null
  indexes?: string[]
  passwordAuth?: { enabled?: boolean; identityFields: string[] }
}

// ---------------------------------------------------------------------------
// Rule fragments — the shared-membership pattern (D1): a record is visible
// and writable by the group owner and by group members.
// ---------------------------------------------------------------------------
const MEMBER_OF_GROUP = `@collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= group`
const MEMBER_OF_GROUP_BY_BODY = `@collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= @request.body.group`
const GROUP_ACCESS = `group.owner = @request.auth.id || ${MEMBER_OF_GROUP}`
const GROUP_ACCESS_CREATE = `group.owner = @request.auth.id || ${MEMBER_OF_GROUP_BY_BODY}`

// Record timestamps (PB 0.40 only has them if defined) — the sync layer
// (phase 5) keys last-write-wins off `updated`.
const stamps = (): FieldDef[] => [
  {
    type: "autodate",
    name: "created",
    onCreate: true,
    onUpdate: false,
    hidden: false,
    presentable: false,
  },
  {
    type: "autodate",
    name: "updated",
    onCreate: true,
    onUpdate: true,
    hidden: false,
    presentable: false,
  },
]

// users ---------------------------------------------------------------------
// Mirrors UserProfile (username, firstName, lastName, avatar as inline SVG
// data-URI text). email/verification/password are PB auth system fields.
const users: CollectionDef = {
  name: "users",
  type: "auth",
  passwordAuth: { enabled: true, identityFields: ["email"] },
  // Profiles are visible to any authenticated user (needed for group member
  // lists — "shared group" correlation is not expressible in flat PB rules).
  // Email is NOT exposed: PB gates it per-record via `emailVisibility`.
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  // Open registration for now (BFF-mediated); invites/verification in phase 3.
  createRule: "",
  updateRule: "id = @request.auth.id",
  deleteRule: "id = @request.auth.id",
  fields: [
    {
      type: "text",
      name: "username",
      required: true,
      hidden: false,
      presentable: true,
      min: 2,
      max: 64,
      pattern: "^[a-zA-Z0-9_-]+$",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "firstName",
      required: false,
      hidden: false,
      presentable: false,
      min: 0,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "lastName",
      required: false,
      hidden: false,
      presentable: false,
      min: 0,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    // Inline SVG data-URI (common UserProfile.avatar) — text, not file, to
    // keep the profile self-contained; revisit if size becomes a problem.
    {
      // Optional: PB selects have no default value, and open registration
      // must not be forced to send it — absence means "user".
      type: "select",
      name: "role",
      required: false,
      hidden: false,
      presentable: false,
      maxSelect: 1,
      values: ["user", "admin"],
    },
    {
      type: "text",
      name: "avatar",
      required: false,
      hidden: false,
      presentable: false,
      min: 0,
      max: 0,
      pattern: "",
      autogeneratePattern: "",
    },
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`)"],
}

// groups --------------------------------------------------------------------
// A group is a shared workspace (D1): it owns categories, items, lists.
// Rules written explicitly (a member-of-group fragment with `group` swapped
// for `id` via regex would also clobber the field name inside
// `@collection.group_members.group`).
const groups: CollectionDef = {
  name: "groups",
  type: "base",
  listRule:
    "owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= id",
  viewRule:
    "owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= id",
  createRule:
    '@request.auth.id != "" && @request.body.owner = @request.auth.id',
  updateRule: "owner = @request.auth.id",
  deleteRule: "owner = @request.auth.id",
  fields: [
    {
      type: "text",
      name: "name",
      required: true,
      hidden: false,
      presentable: true,
      min: 1,
      max: 120,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "relation",
      name: "owner",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "users",
      cascadeDelete: false,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
}

// group_members -------------------------------------------------------------
// Join collection: user ↔ group with role. Drives every membership rule.
const groupMembers: CollectionDef = {
  name: "group_members",
  type: "base",
  listRule: "user = @request.auth.id || group.owner = @request.auth.id",
  viewRule: "user = @request.auth.id || group.owner = @request.auth.id",
  // Create evaluated against the hydrated record (validated by the phase-2
  // gate); owner invites, members can't self-add.
  createRule: "group.owner = @request.auth.id",
  updateRule: null,
  // Owner removes members; members can leave on their own.
  deleteRule: "group.owner = @request.auth.id || user = @request.auth.id",
  fields: [
    {
      type: "select",
      name: "role",
      required: true,
      hidden: false,
      presentable: false,
      maxSelect: 1,
      values: ["owner", "member"],
    },
    {
      type: "relation",
      name: "group",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    {
      type: "relation",
      name: "user",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "users",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: [
    "CREATE UNIQUE INDEX `idx_group_members_unique` ON `group_members` (`group`, `user`)",
  ],
}

// categories ----------------------------------------------------------------
// Category (common `Category`); the `uncategorized` sentinel is provisioned
// per group by the groups service (phase 3), matched by name.
const categories: CollectionDef = {
  name: "categories",
  type: "base",
  listRule: GROUP_ACCESS,
  viewRule: GROUP_ACCESS,
  createRule: GROUP_ACCESS_CREATE,
  updateRule: GROUP_ACCESS,
  deleteRule: GROUP_ACCESS,
  fields: [
        {
      type: "text",
      name: "localId",
      required: false,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "name",
      required: true,
      hidden: false,
      presentable: true,
      min: 1,
      max: 120,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "select",
      name: "frequency",
      required: true,
      hidden: false,
      presentable: false,
      maxSelect: 1,
      values: [...CATEGORY_FREQUENCIES],
    },
    // Stable palette slot (index into the active palette's colors) — mirrors
    // common Category.color; empty = neutral ("no categorical color").
    {
      type: "number",
      name: "color",
      required: false,
      hidden: false,
      presentable: false,
      min: 0,
      max: 64,
      onlyInt: true,
    },
    {
      type: "relation",
      name: "group",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_categories_group_local` ON `categories` (`group`, `localId`)"],
}

// items ---------------------------------------------------------------------
// CatalogItem (common): name + category reference (reassignment to the
// sentinel is app-level, hence cascadeDelete: false on category).
const items: CollectionDef = {
  name: "items",
  type: "base",
  listRule: GROUP_ACCESS,
  viewRule: GROUP_ACCESS,
  createRule: GROUP_ACCESS_CREATE,
  updateRule: GROUP_ACCESS,
  deleteRule: GROUP_ACCESS,
  fields: [
        {
      type: "text",
      name: "localId",
      required: false,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "name",
      required: true,
      hidden: false,
      presentable: true,
      min: 1,
      max: 200,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "relation",
      name: "category",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "categories",
      cascadeDelete: false,
      minSelect: 1,
      maxSelect: 1,
    },
    {
      type: "relation",
      name: "group",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_items_group_local` ON `items` (`group`, `localId`)"],
}

// list_entries --------------------------------------------------------------
// ListEntry (common): a specific entry of an item on the pending list.
const listEntries: CollectionDef = {
  name: "list_entries",
  type: "base",
  listRule: GROUP_ACCESS,
  viewRule: GROUP_ACCESS,
  createRule: GROUP_ACCESS_CREATE,
  updateRule: GROUP_ACCESS,
  deleteRule: GROUP_ACCESS,
  fields: [
        {
      type: "text",
      name: "localId",
      required: false,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "bool",
      name: "checked",
      required: true,
      hidden: false,
      presentable: false,
    },
    {
      type: "number",
      name: "addedAt",
      required: true,
      hidden: false,
      presentable: false,
      min: 0,
      max: 0,
      onlyInt: true,
    },
    {
      type: "relation",
      name: "item",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "items",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    {
      type: "relation",
      name: "group",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_list_entries_group_local` ON `list_entries` (`group`, `localId`)"],
}

// history_events ------------------------------------------------------------
// HistoryEvent (common): append-only log with name/category snapshots (the
// referenced item may be renamed or deleted; snapshots keep history stable).
// itemId/categoryId stay plain text (not relations) for that reason.
const historyEvents: CollectionDef = {
  name: "history_events",
  type: "base",
  listRule: GROUP_ACCESS,
  viewRule: GROUP_ACCESS,
  createRule: GROUP_ACCESS_CREATE,
  updateRule: null,
  deleteRule: null,
  fields: [
        {
      type: "text",
      name: "localId",
      required: false,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "select",
      name: "action",
      required: true,
      hidden: false,
      presentable: false,
      maxSelect: 1,
      values: ["add", "remove"],
    },
    {
      type: "text",
      name: "itemId",
      required: true,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "itemName",
      required: true,
      hidden: false,
      presentable: false,
      min: 1,
      max: 200,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "categoryId",
      required: true,
      hidden: false,
      presentable: false,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "text",
      name: "categoryName",
      required: true,
      hidden: false,
      presentable: false,
      min: 1,
      max: 120,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "number",
      name: "timestamp",
      required: true,
      hidden: false,
      presentable: false,
      min: 0,
      max: 0,
      onlyInt: true,
    },
    {
      type: "relation",
      name: "group",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_history_events_group_local` ON `history_events` (`group`, `localId`)"],
}

// notifications -------------------------------------------------------------
// Reserved (D4 — channel undecided). User-scoped stub; refined in phase 5+.
const notifications: CollectionDef = {
  name: "notifications",
  type: "base",
  listRule: "user = @request.auth.id",
  viewRule: "user = @request.auth.id",
  createRule: "user = @request.auth.id",
  updateRule: "user = @request.auth.id",
  deleteRule: "user = @request.auth.id",
  fields: [
    {
      type: "text",
      name: "type",
      required: true,
      hidden: false,
      presentable: true,
      min: 1,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
    {
      type: "json",
      name: "payload",
      required: false,
      hidden: false,
      presentable: false,
      maxSize: 2000000,
    },
    {
      type: "bool",
      name: "read",
      required: false,
      hidden: false,
      presentable: false,
    },
    {
      type: "relation",
      name: "user",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "users",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    {
      type: "relation",
      name: "group",
      required: false,
      hidden: false,
      presentable: false,
      collectionName: "groups",
      cascadeDelete: true,
      minSelect: 0,
      maxSelect: 1,
    },
    ...stamps(),
  ],
}

// Dependency order: relations always reference collections defined earlier
// (users exists by default in every PB instance).
export const desiredCollections: CollectionDef[] = [
  users,
  groups,
  groupMembers,
  categories,
  items,
  listEntries,
  historyEvents,
  notifications,
]

/** The sentinel category name provisioned per group (phase 3 groups service). */
export const SENTINEL_CATEGORY_NAME = UNCATEGORIZED_NAME
