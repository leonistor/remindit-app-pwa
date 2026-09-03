# PWA sync design (phase 5)

How the local-first PWA syncs with the BFF/PocketBase backend. Read with
[docs/ROADMAP.md](../../docs/ROADMAP.md) (decisions D1/D2/D8) and
[bff/docs/SCHEMA.md](../../bff/docs/SCHEMA.md) (collections + rules).

## Goals

- Local-first stays true: every feature works offline; sync is an overlay,
  never a gate.
- Shared groups: users in a group see the same categories, items and list
  (D1), with the current device's local data becoming their group data on
  first sign-in.
- No invasive store rewrites: the sync layer observes the existing nanostores
  instead of threading through every mutation path.

## Data-plane decision (resolves D2/§8)

**Hybrid, confirming the roadmap recommendation:**

| Concern | Path | Why |
|---------|------|-----|
| Account ops (register/login/logout/me), group management, notifications | typed BFF endpoints (`/api/*`) | already built (phase 3), contract-tested |
| Record CRUD + realtime (categories, items, list_entries, history_events, profile) | **scoped authenticated `/pb/*` forwarder** on the BFF → PocketBase, using the PB JS SDK client-side with `baseUrl = PUBLIC_BFF_URL + "/pb"` | PB's record API + API rules **are** the member-scoped CRUD + realtime implementation (verified live in the phase-2/3 rule matrix); re-implementing them as bespoke endpoints would duplicate authorization logic and lose the subscription machinery |

The forwarder requires a valid BFF session, forwards the *rotated* token, and
streams responses unbuffered (SSE). The pwa never talks to PocketBase
directly (D2) — the PB SDK's `baseUrl` points at the BFF.

## Identity model

- **Local ids stay local.** Existing records keep their generated ids
  (dataset items use deterministic FNV-1a ids; entries/history use runtime
  ids). Rewriting local ids would break history snapshots and the
  recommender.
- **PB records gain a `localId` text field** (categories, items,
  list_entries, history_events) with a unique index per group — server-side
  dedupe + idempotent pushes.
- **The device keeps a sync map** (`remindit:sync-map`): per collection,
  `localId → pbId`. The pwa's local sentinel `uncategorized` maps to the
  group's server-side sentinel category (matched by name, provisioned
  client-side on group bootstrap — PB rules already allow it).
- Cross-device: PB is the hub. A second device adopts remote records into
  its local stores through the same reconcile (its own map, built on first
  pull).

## Reconciliation — journal + three-way, not an op queue

The stores have no single mutation funnel (direct nanostore `set`s), so an
operation queue would mean instrumenting every path. Instead: **periodic and
event-driven full reconciliation** (datasets are small — a shopping list):

1. **Journal** (`remindit:sync-journal`): per collection, `{ [pbId]:
   updated-at-string }` as seen at the last successful sync, plus a
   tombstone list (`localId` of locally deleted records).
2. On reconcile, per record:
   - local-only → create remotely (with `localId`), journal it;
   - remote-only → adopt locally (map pbId → new local id is **not**
     needed — remote records are materialized locally under their own
     localId when they come from another device, using the record's
     `localId` field if present, else the pbId as the local id);
   - both, content differs:
     - remote `updated` **newer** than journal → remote wins (overwrite
       local);
     - remote `updated` **equal** to journal → local wins (push);
     - journal missing (never synced) → remote wins (LWW baseline);
   - in journal, absent locally → **local delete** (tombstone: delete
     remotely, drop from journal);
   - in journal, absent remotely → **remote was deleted** → delete locally,
     drop tombstone.
3. **Conflicts = last-write-wins by PB's server-side `updated`** (client
   clocks are not trusted). Documented consequence: simultaneous offline
   edits to the same record — the later write wins wholesale.
4. `history_events` is append-only: reconcile only creates (both
   directions); deletes never sync.

Trigger points: sign-in, group switch, store subscription (debounced 500ms),
PB realtime event (debounced), app foreground/online events, 60s interval.

## Realtime

One PB SDK subscription per collection (`subscribe("*", { filter: group })`)
via the forwarder (SSE streams through it — phase-1 spike verified the
transport). Events trigger a debounced reconcile; the reconcile itself is
idempotent, so self-echoes are harmless.

## Profile sync

`$user` ↔ `users` record: push username/firstName/lastName/avatar on change
(LWW), pull on sign-in when the remote record is newer than the journal.
`email` is auth-owned (login identity) — never synced from the profile.

## Notifications (D4 status)

The channel decision stays **open** (no push/email in this phase). The
consumer is in-app only: `/api/notifications` listed on sign-in + poll on
reconcile, surfaced in the Profile view. Dispatch (what creates
notifications) arrives with the channel decision.

## Security

- PB rules are the authorization boundary (the token-scoped SDK calls are
  rule-evaluated as the user — same as every phase-3 BFF call).
- The forwarder only accepts authenticated BFF sessions and forwards the
  rotated token; PB stays internal (D2).
- `remindit:sync-*` keys hold no secrets beyond the PB token itself, which is
  already client-held; signing out clears session + sync keys (journal/map
  included) but NOT the local data.

## Testing

- BFF: forwarder integration tests (auth-gated, rule-scoped CRUD through the
  proxy, `skip` when PB is down — phase-3 pattern).
- pwa: the pure diff is unit-tested with fixture stores (no network) in
  [tests/stores/sync-reconcile.test.ts](../tests/stores/sync-reconcile.test.ts);
  the engine has a stubbed PB/BFF-client test in
  [tests/stores/sync-engine.test.ts](../tests/stores/sync-engine.test.ts)
  (journal stamping on remote-win applies, concurrent-connect
  serialization); the live two-"device" scenario is covered by the phase
  gate (dev:all + two browser profiles).

## Explicitly deferred

- Multi-group switcher UI (engine keys off one `activeGroupId`; adding the
  picker later is UI-only).
- Attachment/file sync (avatars stay data-URIs).
- Push/email channels + notification dispatch (D4).
- Conflict UI (manual merge) — LWW is the documented policy.
