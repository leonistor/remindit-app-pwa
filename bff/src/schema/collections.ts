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
  min?: number | null
  max?: number | null
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
  type: "base" | "view" | "auth"
  /**
   * View collections only: the SQL SELECT the collection is computed from.
   * PB auto-derives the fields from the query (`fields` stays empty) and
   * requires every query to select an `id` column. The SELECT runs directly
   * against the SQLite tables — base-collection API rules do NOT apply inside
   * it, so the view's own list/view rules are the only authorization guard.
   */
  viewQuery?: string
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
// and writable by the team owner and by team members.
// ---------------------------------------------------------------------------
const MEMBER_OF_TEAM = `@collection.team_members.user ?= @request.auth.id && @collection.team_members.team ?= team`
const MEMBER_OF_TEAM_BY_BODY = `@collection.team_members.user ?= @request.auth.id && @collection.team_members.team ?= @request.body.team`
const TEAM_ACCESS = `team.owner = @request.auth.id || ${MEMBER_OF_TEAM}`
const TEAM_ACCESS_CREATE = `team.owner = @request.auth.id || ${MEMBER_OF_TEAM_BY_BODY}`

// View variants: rows that carry a `team` column use the shared fragments
// unchanged; rows that ARE a team (`team_details` — row id = team id) use
// the `id` form.
const MEMBER_OF_TEAM_ROW = `@collection.team_members.user ?= @request.auth.id && @collection.team_members.team ?= id`
const TEAM_ACCESS_ROW = `owner = @request.auth.id || ${MEMBER_OF_TEAM_ROW}`

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
  // Profiles are visible to any authenticated user (needed for team member
  // lists — "shared team" correlation is not expressible in flat PB rules).
  // Email is NOT exposed: PB gates it per-record via `emailVisibility`.
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  // BFF-mediated registration uses superuser (bypasses rules). The rule
  // blocks authenticated users from creating accounts through the /pb
  // forwarder — anon (`@request.auth.id = ""`) is required for PB API flow.
  createRule: '@request.auth.id = ""',
  // Users may edit their own profile but NOT escalate privileges — the
  // :isset guard rejects any request that carries a `role` field.
  updateRule: "id = @request.auth.id && @request.body.role:isset = false",
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
      // NOT hidden: the admin app gates on role from the login/auth response
      // and `requireAdmin` reads `record.role` from the owner-scoped record.
      // PB omits hidden fields even from the record owner's own auth/detail
      // reads, which would make every admin check see "user" (phase-6 smoke
      // passed only because the dev DB had drifted to hidden:false).
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
    // One-way feedback bridge (phase: feedback): the Answer-side username
    // provisioned at registration (or backfill). Hidden — internal linkage
    // written/read by the BFF only, never surfaced to clients.
    {
      type: "text",
      name: "feedback_username",
      required: false,
      hidden: true,
      presentable: false,
      min: 0,
      max: 64,
      pattern: "",
      autogeneratePattern: "",
    },
  ],
  indexes: ["CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`)"],
}

// teams ----------------------------------------------------------------------
// A team is a shared workspace (D1): it owns categories, items, lists.
// Renamed from `groups` — the SQL keyword collision invited bugs in view
// queries; the one-off scripts/rename-groups-to-teams.ts migrates live data.
const teams: CollectionDef = {
  name: "teams",
  type: "base",
  listRule: TEAM_ACCESS_ROW,
  viewRule: TEAM_ACCESS_ROW,
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

// team_members -------------------------------------------------------------
// Join collection: user ↔ team with role. Drives every membership rule.
const teamMembers: CollectionDef = {
  name: "team_members",
  type: "base",
  listRule: "user = @request.auth.id || team.owner = @request.auth.id",
  viewRule: "user = @request.auth.id || team.owner = @request.auth.id",
  // Create evaluated against the hydrated record (validated by the phase-2
  // gate); owner invites, members can't self-add.
  createRule: "team.owner = @request.auth.id",
  updateRule: null,
  // Owner removes members; members can leave on their own.
  deleteRule: "team.owner = @request.auth.id || user = @request.auth.id",
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
      name: "team",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "teams",
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
    "CREATE UNIQUE INDEX `idx_team_members_unique` ON `team_members` (`team`, `user`)",
  ],
}

// categories ----------------------------------------------------------------
// Category (common `Category`); the `uncategorized` sentinel is provisioned
// per team by the teams service (phase 3), matched by name.
const categories: CollectionDef = {
  name: "categories",
  type: "base",
  listRule: TEAM_ACCESS,
  viewRule: TEAM_ACCESS,
  createRule: TEAM_ACCESS_CREATE,
  updateRule: TEAM_ACCESS,
  deleteRule: TEAM_ACCESS,
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
      name: "team",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "teams",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: [
    "CREATE UNIQUE INDEX `idx_categories_team_local` ON `categories` (`team`, `localId`)",
  ],
}

// items ---------------------------------------------------------------------
// CatalogItem (common): name + category reference (reassignment to the
// sentinel is app-level, hence cascadeDelete: false on category).
const items: CollectionDef = {
  name: "items",
  type: "base",
  listRule: TEAM_ACCESS,
  viewRule: TEAM_ACCESS,
  createRule: TEAM_ACCESS_CREATE,
  updateRule: TEAM_ACCESS,
  deleteRule: TEAM_ACCESS,
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
      name: "team",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "teams",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: [
    "CREATE UNIQUE INDEX `idx_items_team_local` ON `items` (`team`, `localId`)",
  ],
}

// list_entries --------------------------------------------------------------
// ListEntry (common): a specific entry of an item on the pending list.
const listEntries: CollectionDef = {
  name: "list_entries",
  type: "base",
  listRule: TEAM_ACCESS,
  viewRule: TEAM_ACCESS,
  createRule: TEAM_ACCESS_CREATE,
  updateRule: TEAM_ACCESS,
  deleteRule: TEAM_ACCESS,
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
      // Not required: a list entry starts UNCHECKED (the app's default state),
      // and PB 0.40 treats `false` on a required bool as "blank" — rejecting
      // every freshly added item.
      required: false,
      hidden: false,
      presentable: false,
    },
    {
      type: "number",
      name: "addedAt",
      required: true,
      hidden: false,
      presentable: false,
      // Epoch ms — upper bound must stay unset (PB 0.40 treats `max: 0` as the
      // literal bound 0, which would reject every real timestamp).
      min: 0,
      max: null,
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
      name: "team",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "teams",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: [
    "CREATE UNIQUE INDEX `idx_list_entries_team_local` ON `list_entries` (`team`, `localId`)",
  ],
}

// history_events ------------------------------------------------------------
// HistoryEvent (common): append-only log with name/category snapshots (the
// referenced item may be renamed or deleted; snapshots keep history stable).
// itemId/categoryId stay plain text (not relations) for that reason.
const historyEvents: CollectionDef = {
  name: "history_events",
  type: "base",
  listRule: TEAM_ACCESS,
  viewRule: TEAM_ACCESS,
  createRule: TEAM_ACCESS_CREATE,
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
      // Epoch ms — upper bound must stay unset (PB 0.40 treats `max: 0` as the
      // literal bound 0, which would reject every real timestamp).
      min: 0,
      max: null,
      onlyInt: true,
    },
    {
      type: "relation",
      name: "team",
      required: true,
      hidden: false,
      presentable: false,
      collectionName: "teams",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 1,
    },
    ...stamps(),
  ],
  indexes: [
    "CREATE UNIQUE INDEX `idx_history_events_team_local` ON `history_events` (`team`, `localId`)",
  ],
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
      name: "team",
      required: false,
      hidden: false,
      presentable: false,
      collectionName: "teams",
      cascadeDelete: true,
      minSelect: 0,
      maxSelect: 1,
    },
    ...stamps(),
  ],
}

// ---------------------------------------------------------------------------
// View collections — read-only, PB-computed from SQL:
// - the SELECT runs directly against the SQLite tables (base-collection rules
//   don't apply inside it) → every team-scoped view re-states the membership
//   rule on its own rows; `platform_stats` stays superuser-only;
// - `fields` is empty by design — PB derives the schema from `viewQuery`;
// - no realtime events and no indexes on views — the sync layer (phase 5)
//   keeps subscribing to the base collections; views are read-shape helpers
//   for the BFF services and the pwa (via the /pb forwarder).
// ---------------------------------------------------------------------------

// Flattened memberships × profiles: replaces the `expand: "user"` + fallback
// dance in the teams service; also scopes profiles to shared teams per-row
// (the users-collection relaxation "any authenticated user" can shrink later).
const teamMemberDetails: CollectionDef = {
  name: "team_member_details",
  type: "view",
  viewQuery: `
    SELECT
      team_members.id,
      team_members.team,
      team_members.role,
      team_members.created AS joinedAt,
      users.id AS userId,
      users.username,
      users.firstName,
      users.lastName,
      users.avatar
    FROM team_members
    JOIN users ON users.id = team_members.user
  `,
  listRule: MEMBER_OF_TEAM,
  viewRule: MEMBER_OF_TEAM,
  fields: [],
}

// Per-team dashboard row: owner username + counts, replacing the two
// full-list fetches + JS joins in the admin service (listGroups).
const teamDetails: CollectionDef = {
  name: "team_details",
  type: "view",
  viewQuery: `
    SELECT
      teams.id,
      teams.name,
      teams.owner,
      teams.created,
      (SELECT users.username FROM users WHERE users.id = teams.owner) AS ownerUsername,
      COUNT(team_members.id) AS membersCount,
      (SELECT COUNT(*) FROM items WHERE items.team = teams.id) AS itemsCount,
      (SELECT COUNT(*) FROM list_entries
        WHERE list_entries.team = teams.id AND list_entries.checked = 0) AS pendingCount,
      (SELECT MAX(list_entries.addedAt) FROM list_entries
        WHERE list_entries.team = teams.id) AS lastActivityAt
    FROM teams
    LEFT JOIN team_members ON team_members.team = teams.id
    GROUP BY teams.id
  `,
  listRule: TEAM_ACCESS_ROW,
  viewRule: TEAM_ACCESS_ROW,
  fields: [],
}

// Single-row platform counters (constant `id`): one query for the marketing
// /api/stats and the admin overview instead of N × getList(1, 1) metadata pokes.
// Superuser-only (null rules) — both consumers read superuser-side anyway.
const platformStats: CollectionDef = {
  name: "platform_stats",
  type: "view",
  viewQuery: `
    SELECT
      'platform' AS id,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM teams) AS teams,
      (SELECT COUNT(*) FROM items) AS items,
      (SELECT COUNT(*) FROM list_entries) AS listEntries,
      (SELECT COUNT(*) FROM history_events) AS historyEvents
  `,
  listRule: null,
  viewRule: null,
  fields: [],
}

// The shopping-list screen in one query: entry + item + category name/color.
const listEntriesDetailed: CollectionDef = {
  name: "list_entries_detailed",
  type: "view",
  viewQuery: `
    SELECT
      list_entries.id,
      list_entries.team,
      list_entries.localId,
      list_entries.checked,
      list_entries.addedAt,
      items.id AS itemId,
      items.name AS itemName,
      items.localId AS itemLocalId,
      categories.id AS categoryId,
      categories.name AS categoryName,
      categories.color AS categoryColor
    FROM list_entries
    JOIN items ON items.id = list_entries.item
    JOIN categories ON categories.id = items.category
  `,
  listRule: MEMBER_OF_TEAM,
  viewRule: MEMBER_OF_TEAM,
  fields: [],
}

// Per-category item/pending counts (category screen, "in use" delete-guards).
const categoryStats: CollectionDef = {
  name: "category_stats",
  type: "view",
  viewQuery: `
    SELECT
      categories.id,
      categories.team,
      categories.name,
      categories.frequency,
      categories.color,
      (SELECT COUNT(*) FROM items WHERE items.category = categories.id) AS itemsCount,
      (SELECT COUNT(*) FROM list_entries
        JOIN items ON items.id = list_entries.item
        WHERE items.category = categories.id AND list_entries.checked = 0) AS pendingCount
    FROM categories
  `,
  listRule: MEMBER_OF_TEAM,
  viewRule: MEMBER_OF_TEAM,
  fields: [],
}

// Purchase intelligence derived from the append-only history (join on the
// itemId text snapshot, so renamed/deleted items can't break the view):
// groundwork for "buy again" suggestions in later phases.
const itemStats: CollectionDef = {
  name: "item_stats",
  type: "view",
  viewQuery: `
    SELECT
      items.id,
      items.team,
      items.name,
      items.category,
      COUNT(CASE WHEN history_events.action = 'add' THEN 1 END) AS purchaseCount,
      MAX(CASE WHEN history_events.action = 'add'
          THEN history_events.timestamp END) AS lastPurchasedAt
    FROM items
    LEFT JOIN history_events ON history_events.itemId = items.id
    GROUP BY items.id
  `,
  listRule: MEMBER_OF_TEAM,
  viewRule: MEMBER_OF_TEAM,
  fields: [],
}

// Dependency order: relations always reference collections defined earlier
// (users exists by default in every PB instance); view queries select only
// tables that exist, so every view is declared AFTER all base/auth
// collections (the migrate script's structure pass creates in order).
export const desiredCollections: CollectionDef[] = [
  users,
  teams,
  teamMembers,
  categories,
  items,
  listEntries,
  historyEvents,
  notifications,
  teamMemberDetails,
  teamDetails,
  platformStats,
  listEntriesDetailed,
  categoryStats,
  itemStats,
]

/** The sentinel category name provisioned per team (phase 3 teams service). */
export const SENTINEL_CATEGORY_NAME = UNCATEGORIZED_NAME
