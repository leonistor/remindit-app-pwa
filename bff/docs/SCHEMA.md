# BFF PocketBase schema

The served PocketBase schema is **code**: `src/schema/collections.ts` is the
desired state (D7), derived from the `@remindit/common` domain types, and
`scripts/migrate.ts` reconciles the live PB towards it. Never hand-edit
collections in the PB Admin UI; inspect via pocketbase-mcp instead
(`opencode.jsonc` → `pocketbase`, disabled by default).

## Mapping — common domain → collections

| PB collection | Common type | Fields | Notes |
|---------------|-------------|--------|-------|
| `users` (auth) | `UserProfile` | `username`* (unique), `firstName`, `lastName`, `avatar` (text: inline SVG data-URI) | email/password/verified are PB auth system fields; open registration for now; **profiles visible to any authenticated user** (group member lists need it — "shared group" correlation is not expressible in flat PB rules; email stays gated by PB's `emailVisibility`) |
| `groups` | — (new, D1) | `name`*, `owner` → users* | a group = one shared workspace owning categories/items/lists |
| `group_members` | — (new, D1) | `role`* (`owner`\|`member`), `group`* → groups†, `user`* → users† | join collection; drives every membership rule; unique `(group,user)` |
| `categories` | `Category` | `name`*, `frequency`* (select = `CATEGORY_FREQUENCIES`), `color` (palette slot), `group`* → groups† | |
| `items` | `CatalogItem` | `name`*, `category`* → categories, `group`* → groups† | category reassignment to the sentinel is app-level → `cascadeDelete: false` |
| `list_entries` | `ListEntry` | `checked`*, `addedAt`* (epoch ms), `item`* → items†, `group`* → groups† | |
| `history_events` | `HistoryEvent` | `action`* (`add`\|`remove`), `itemId`*, `itemName`*, `categoryId`*, `categoryName`*, `timestamp`*, `group`* → groups† | append-only (`update`/`delete` = nobody); itemId/categoryId are **text snapshots**, not relations — history survives renames/deletions |
| `notifications` | — (reserved, D4) | `type`*, `payload` (json), `read`, `user`* → users†, `group` → groups (optional) | channel undecided; schema reserved |

\* required · † `cascadeDelete: true` (deleting a group cascades its data;
user deletion cascades memberships/notifications)

## The `uncategorized` sentinel

`common` uses a local sentinel id (`UNCATEGORIZED_ID = "uncategorized"`), but
PB record ids are 15-char generated — so the sentinel is a **real category
record provisioned per group** by the groups service (phase 3), matched by
`name = UNCATEGORIZED_NAME`. The sync layer (phase 5) maps the local sentinel
id ↔ the group's PB sentinel record. Categories/items create rules already
allow provisioning it (they are ordinary member-scoped creates).

## API rules

PB rule semantics: `""` = anyone (incl. anon), `null` = nobody (superuser
only). Baseline (phase 2), all verified live (see "Rule matrix" below):

| Collection | list/view | create | update | delete |
|------------|-----------|--------|--------|--------|
| `users` | any authenticated user (profiles; email gated by `emailVisibility`) | `""` (open signup) | self | self |
| `groups` | owner ∨ member (via `@collection.group_members`) | auth ∧ `@request.body.owner` = self | owner | owner |
| `group_members` | self-membership ∨ group owner | group owner (hydrated record) | nobody | group owner ∨ self (leave) |
| `categories` / `items` / `list_entries` | group owner ∨ member | group owner ∨ member (group from `@request.body`) | group owner ∨ member | group owner ∨ member |
| `history_events` | group owner ∨ member | group owner ∨ member | nobody (append-only) | nobody |
| `notifications` | self | self | self | self |

The shared fragment for member-scoped collections:

```
group.owner = @request.auth.id
|| @collection.group_members.user ?= @request.auth.id
   && @collection.group_members.group ?= group          // list/view/update/delete
   && @collection.group_members.group ?= @request.body.group   // create
```

Caveat learned in the phase-2 gate (PB 0.40): **create rules are evaluated
against the hydrated record** — `group.owner = …` works in create rules, and
`@request.body.<relationField>` resolves for membership checks. Don't traverse
further into `@request.body` relations (body values are ids).

### Rule matrix (live-verified, PB 0.40.1)

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | owner creates group (`owner` = self via body) | 200 | ✅ |
| 2 | owner invites member | 200 | ✅ |
| 3 | member lists owner's groups | only member groups | ✅ |
| 4 | member creates category in the group | 200 | ✅ |
| 5 | non-member creates category in the group | 400 | ✅ |
| 6 | invalid `frequency` select value | 400 | ✅ |
| 7 | member escalates own `group_members.role` | 403 | ✅ |
| 8 | member self-leaves group | 204 | ✅ |

## Migration algorithm

`scripts/migrate.ts` (root: `bun run migrate:bff`):

1. Probe PB health (start it with `bun run dev:bff` first).
2. Superuser auth from the root `.env`; if the account doesn't exist,
   provision it via `pocketbase-bin superuser upsert` (same creds).
3. **Pass A — structure:** create missing collections **without rules** (rules
   reference collections by name via `@collection.*`, and PB validates them at
   definition time — everything must exist before any rule is written).
   Relations resolve `collectionName` → live `collectionId`.
4. **Pass B — definitions:** per collection, canonicalize-and-compare the
   managed keys (type, fields, rules, indexes, passwordAuth) against live
   state; patch on drift, skip when unchanged. Server-managed noise is
   stripped on both sides (`id`/`system`/`help`/`primaryKey` keys, system-flag
   fields, the PK field, PB's internal `_pb_users_auth_` indexes).
5. **Idempotency invariant:** running twice ⇒ `unchanged × N` and
   `✓ schema in sync` (the phase-2 gate proves it live).

Never deletes anything: removing a collection/field from the builders leaves
the live schema untouched (deliberate — destructive changes are manual, with
data migration designed per case).
