# V5 review — full-codebase audit (2026-09-04)

A maintainability / hidden-bugs audit of every module (`pwa`, `bff`, `web`,
`admin`, `common`, `feedback`) plus repo-level config, done in a single
session. Architecture is solid — layers respected (routes → services →
repositories, PB never public, nanostores discipline, PB-rule authz) — but the
audit found **one live privilege escalation**, **deterministic local data-loss
races** in the sync engine, and **several silent upgrade-path traps**.

This file is the handoff: what to fix, in what order, with file:line anchors
and concrete fixes. Findings marked `[verified]` were re-traced by the
coordinator after the sub-agent report. Update it as fixes land (check off in
the execution plan below).

---

## Tier 0 — security / data loss (fix first)

### T0-1 `[verified]` Privilege escalation via the `/pb` forwarder — any user can become admin

- `bff/src/schema/collections.ts:125-174` — `users` collection:
  `createRule: ""`, `updateRule: "id = @request.auth.id"`, and `role` is an
  ordinary **writable, unhidden** `select` field with values `["user","admin"]`.
- `bff/src/routes/pb.ts:66-128` — the forwarder re-stamps the caller's token
  (`headers.set("authorization", \`Bearer ${c.get("auth").token}\`)`, line 74)
  and proxies any `GET/POST/PATCH/DELETE` to `/api/collections/*`. The pwa sync
  engine uses `PUBLIC_BFF_URL + "/pb"` as its PB base, so every app user holds
  this data plane.

Two attacks, both trivial:

1. **Self-promotion:** `PATCH /pb/api/collections/users/records/{ownId}` with
   `{"role":"admin"}` — `updateRule` allows it, PB validates against the enum
   → accepted. Next `requireAdmin` (`bff/src/routes/admin.ts:15`) passes.
2. **Admin minting:** `POST /pb/api/collections/users/records` with
   `{username, email, password, passwordConfirm, role: "admin"}` — `createRule: ""`
   allows it.

`docs/SCHEMA.md:72` only tests `team_members.role` escalation, not
`users.role` — the gap went unnoticed.

**Fix (defense in depth, pick ≥2):**
- `users.updateRule: 'id = @request.auth.id && @request.body.role:isset = false'`
  (verify `:isset` support on PB 0.40).
- `users.createRule: '@request.auth.id = ""'` — keeps the anonymous register
  flow (`bff/src/services/auth.ts:28`) working, blocks authenticated creation.
- Restrict `/pb/api/*` to the **sync collections only**
  (teams/categories/items/list_entries/history_events/notifications + realtime)
  — a forwarder allowlist is the cleanest primary defense since PB rules are
  per-collection and easy to miss.
- Keep `role` admin-mutable only via the superuser `adminService.createUser`.

### T0-2 `[verified]` `ensureGroup` silently re-points groups without clearing sync buffers → deterministic local data loss

- `pwa/src/stores/sync/engine.ts:608-623` — when the stored group is gone
  (`groups.find(...) ?? groups[0]`), `$syncGroup` is re-pointed but
  `clearSyncBuffers()` is **never called** (`recoverActiveGroup`, line 867,
  correctly routes through `switchGroup`, which does clear).
- `pwa/src/stores/sync/reconcile.ts:98-111` — the "vanish sweep" deletes any
  journaled `pbId` not present in the remote fetch. With the stale journal from
  the old group, the first `reconcileAll` after re-pointing issues
  `localDelete` for **every** locally-synced record.

Trigger: relaunch after being kicked from a group / the owner deletes it. The
exact scenario the code claims to handle becomes permanent silent data loss.

**Fix:** in `ensureGroup`, when `stored` is not among `groups`, call
`clearSyncBuffers()` (and reset `lastSeenIds`) before re-pointing — or simply
delegate to `switchGroup(active.id)` exactly like `recoverActiveGroup`.

### T0-3 `[verified]` `runConnect` resurrects a torn-down session (sign-out / account-switch race)

- `pwa/src/stores/sync/engine.ts:636-668` — `const session = getSession()` is
  captured once at entry, then re-`setSession({...session, ...})` after the
  `await bffApi.me(session.token)`. If `signOut()` (`engine.ts:822`) or a
  second `signIn()` runs while `me()` is in flight, the connect **silently
  re-authenticates the previous user** and proceeds to `ensureGroup` +
  `subscribeRealtime`.

**Fix:** re-read `getSession()` after every await and abort if `userId`/`token`
no longer matches the captured value. Cleanest: a monotonically increasing
session "generation" counter bumped by `setSession(null)` / `signIn`, checked
by `runConnect` after each await.

### T0-4 `[verified]` `switchGroup` reuses an in-flight connect bound to the old group

- `pwa/src/stores/sync/engine.ts:842-858` + `:629-634` + `:636-668` —
  `switchGroup` awaits `connect()`, which reuses `connectPromise` if non-null.
  The in-flight `runConnect` captured `groupId` from `ensureGroup()` **before**
  the switch and later applies it unconditionally:
  `setSyncState({ status: "online", groupId })` and
  `subscribeRealtime(groupId)` revert to the old group.

Result: `$syncGroup` says the new group, but realtime is subscribed to the old
one; live updates missed until the 60s heartbeat or foreground trigger.

**Fix:** `runConnect` must re-read `$syncGroup` after each await and use the
*current* group for `setSyncState`/`subscribeRealtime`; or `connect()` takes the
target group and refuses to reuse a promise bound to a different group.

### T0-5 `[verified]` Swipe row: tapping a revealed row opens the edit dialog instead of closing

- `pwa/src/components/catalog/swipeable-item-row.tsx:152-157` — the foreground
  div's `onClick` closes the row when `revealed`, but the edit `<button>` lives
  *inside* that div (children from `category-items-table.tsx`), so its `onClick`
  fires first (bubble), then `close()` — the opposite of the comment's intent.
  The delete layer is only 80px wide, so most taps land on the foreground.

**Fix:** `onClickCapture={(e) => { if (revealed) { e.stopPropagation(); close() } }}`.

### T0-6 `[verified]` Swipe row: fast fling bounces back (stale state in `onTouchEndOrOnMouseUp`)

- `pwa/src/components/catalog/swipeable-item-row.tsx:62-93` —
  `react-swipeable` fires `onSwiped` then `onTouchEndOrOnMouseUp`
  synchronously, both reading the same props snapshot. `setOffset`/`setRevealed`
  in `onSwiped` are async, so `onTouchEndOrOnMouseUp` runs with **stale**
  `revealed`/`offset` and snaps the row back closed (left fling) or re-opens it
  (right fling) whenever the velocity threshold (< 250ms) is crossed.

**Fix:** track the drag offset in a ref updated synchronously; make
`onTouchEndOrOnMouseUp` read the ref (or merge both handlers into one snap
decision inside `onSwiped`).

### T0-7 `[verified]` Feedback i18n bundles are not version-keyed — version bump ships stale translations

- `feedback/scripts/setup.ts:130-141` — extraction is gated only on the
  `i18n.yaml` marker, independent of the version stamp (line 50-57). Bump
  `FEEDBACK_VERSION` → binary replaced, i18n block sees the marker and skips →
  the new binary boots against the old version's bundles.

**Fix:** key the marker by version (e.g. `answer-data/i18n/<version>/`, or move
the i18n block inside the version-mismatch branch).

### T0-8 `[verified]` Known default admin passwords reach production

- `bff/src/env.ts:48-52` — `answerAdminPassword` falls back to
  `"change-me-dev-only"`; `feedback/src/env.ts:28` — `adminPassword` falls back
  to the same. The BFF logs into Answer with these values
  (`repositories/answer.ts:54-71`). An env omission in prod yields a
  world-known credential. The BFF's PB creds correctly have **no** default.

**Fix:** require both vars with no fallback (throw in env load if missing), or
gate the fallback behind `NODE_ENV !== "production"`.

### T0-9 `[verified]` Build-time env binding + dev-localhost fallbacks ship to production

- `web/src/lib/stats.ts:14`, `admin/src/lib/api.ts:43`, `web/src/routes/download.tsx:21`,
  `web/src/routes/__root.tsx:77-81` — `process.env.PUBLIC_*` dot-access is
  **replaced at build time** (verified against Rsbuild docs). The
  `?? "http://127.0.0.1:3100"` fallback makes a non-local build silently target
  the end user's own `127.0.0.1:3100`.
- `.env.example:36,40,43,55,57` — prod-facing defaults (`PUBLIC_PWA_URL=http://localhost:3000`,
  `PUBLIC_FEEDBACK_URL=http://localhost:5555`) render localhost CTAs when copied verbatim.

**Fix:** adopt the pwa idiom (`import.meta.env?.PUBLIC_*` with a clearly-dev-only
fallback) or guard at build time; comment out / replace the localhost defaults
in `.env.example`; add a build-time warning in the rsbuild configs when
`PUBLIC_BFF_URL` is missing.

---

## Tier 1 — correctness bugs

### Sync engine / stores

- **T1-1** `pwa/src/stores/sync/engine.ts:467-471` — an in-flight reconcile
  re-reads `$syncMap.get()` at persist time and spreads its pass-local copy back
  in. If `switchGroup`/`signOut` cleared buffers mid-pass, the finishing pass
  re-pollutes the cleared stores with the old group's map/journal → same vanish-
  sweep data-loss mechanism as T0-2. **Fix:** snapshot `groupId` at pass start
  and skip the persist (or the pass) if `$syncGroup.get()` changed since.
- **T1-2** `pwa/src/stores/notifications.ts:84-93, 100-113` — `refreshNotifications`
  and `markRead`'s rollback restore stale snapshots after sign-out / account
  switch; user A's data can render for user B. **Fix:** capture `session.userId`
  at entry, bail after each await if it changed; only roll back `markRead` if the
  list hasn't refreshed since.
- **T1-3** `pwa/src/stores/selectors.ts:284-288` + `recommender.ts:193` —
  `$recommendations` computes `Date.now()` only when one of its four inputs
  changes; overdue/soon badges go stale while the app sits open. **Fix:** feed
  `now` from a minute-tick atom included in the computed's dependency list.
- **T1-4** `pwa/src/stores/sync/engine.ts:744-751` — the profile-push timer
  consumes its one shot; if `reconcileAll()` returns early on `applying`, the
  edit isn't pushed until the heartbeat. **Fix:** re-arm the timer on a skipped
  reconcile (or have `reconcileAll` signal "was skipped").

### BFF

- **T1-5** `bff/src/services/groups.ts:41-53` — owner-membership create failure
  is caught and logged → **ownerless teams**. **Fix:** create membership first,
  or delete the team on failure; at minimum make it observable.
- **T1-6** `bff/src/services/admin.ts:96-98` + `schema/collections.ts:230-239`
  (`teams.owner` `cascadeDelete: false`) — `deleteUser` orphans the user's
  teams; `owner = @request.auth.id` rules can never match again → permanently
  immutable. **Fix:** reassign/delete owned teams in `deleteUser`, or reject with
  "user owns N teams".
- **T1-7** `bff/src/routes/auth.ts:17-26` — no rate limiting on `login`/`register`
  (PB 0.40 ships none); register also fans out to the Answer sidecar (amplifier).
  **Fix:** token-bucket / IP throttle middleware, at least on login.
- **T1-8** `bff/src/schema/collections.ts:844-845` — `SENTINEL_CATEGORY_NAME`
  is never provisioned by `groupsService.create` despite `docs/SCHEMA.md:25-32`
  claiming it is. Phase-5 sentinel mapping will mis-map for fresh teams.
  **Fix:** provision in `create` (best-effort), or delete the dead export.
- **T1-9** `bff/src/services/groups.ts:70-96` — `listMembers` returns `200 []`
  to non-members while `GET /:id` 404s. **Fix:** pre-flight the team `getOne`.
- **T1-10** `bff/src/lib/pb-error.ts:27-34` — PB field-level validation payload
  leaks schema internals to anonymous clients (register/login). **Fix:** strip
  `details` on anonymous surfaces or map to the frontends' flattened shape.

### Components

- **T1-11** `pwa/src/components/shopping-list-panel.tsx:47-77` — the View-Transition
  path has no double-tap guard (unlike the fallback) and the fallback `setTimeout`
  is never cleared on unmount. **Fix:** register a sentinel in `animationTimeouts`
  in both paths / disable the chip during travel; clear timers in a cleanup effect.
- **T1-12** `pwa/src/hooks/use-item-travel-transition.ts:84` — `transition.finished`
  rejects on skip/cancel → unhandled rejection. **Fix:** `.catch(() => clearNames(itemId))`.
- **T1-13** `pwa/src/components/notifications-card.tsx:64-71` — failed `markRead`
  silently swallowed. **Fix:** per-row error state / toast, keep retry available.
- **T1-14** `pwa/src/components/catalog/category-items-table.tsx:171-196` — a
  second `AlertDialog` that can **never open** (mobile branch also duplicates
  `ConfirmDelete`). **Fix:** single shared dialog, delete the dead copy.

### admin

- **T1-15** `admin/src/lib/api.ts:48-64` — the validation-error parser reads
  `body.error`, but the BFF puts Zod issues in `body.details` (z.flattenError);
  the whole array-flattening branch is dead → "validation failed" only.
  **Fix:** read `body.details` → `{ fieldErrors, formErrors }`.
- **T1-16** `admin/src/lib/api.ts:110-131` + `login.tsx:43-48` — 403 (non-admin)
  is not handled; token persists, nav keeps showing admin links, every page shows
  an error. **Fix:** treat 403 like 401 for admin endpoints, or let pages
  recognize `AdminApiError.status === 403`.
- **T1-17** `admin/src/routes/users.tsx:42-56`, `groups.tsx:20-33` — stale error
  persists after a later successful retry (index page clears it at load start).
  **Fix:** `setError(null)` at the top of both `load()` callbacks.

### web

- **T1-18** `web/src/lib/stats.ts:1-3` + `bff/src/routes/stats.ts:9` — the BFF
  only sets a `cache-control` header (no server-side cache), so every SSR render
  hits PB; the documented Caddy workflow (`PUBLIC_BFF_URL=https://bff.remindit.localhost`)
  needs `NODE_EXTRA_CA_CERTS` for the local CA or TLS verification fails and stats
  silently degrade. **Fix:** small in-process cache in the BFF; document/correct
  the Caddy workflow.

---

## Tier 2 — clean code / maintainability (batchable)

### BFF

- **T2-1** `toPublicUser` triplicated with drifting mask semantics —
  `services/auth.ts:16-24`, `services/users.ts:24-31`, `services/groups.ts:81-88`;
  `users`/`groups` copies omit `role`, `auth` includes it. **Fix:** one shared
  `toPublicUser(record, { maskEmail })`.
- **T2-2** `routes/admin.ts:26-28` hand-parses `page`/`perPage`/`filter` instead
  of `validatedQuery`; negative/NaN `perPage` reaches PB.
- **T2-3** `services/groups.ts:22-29` + `services/notifications.ts:49-56` —
  unbounded `getFullList` reads; paginate/cap like the admin routes.
- **T2-4** LWW compares timestamps as **strings** (`reconcile.ts:151-152`,
  `engine.ts:541,194`) — correct only while sources share byte-identical
  formatting. **Fix:** `Date.parse` both sides (NaN → raw string fallback).
- **T2-5** `services/stats.ts:23-24`, `services/admin.ts:27-34` — `items[0]`
  dereferenced unconditionally; 500 if the view returns no rows.
- **T2-6** `routes/sse.ts:7-17` — no abort handling on client disconnect; this
  file is the stated reference pattern for phase-5 realtime — fix before copying.
- **T2-7** `services/feedback.ts:21-22` + `repositories/answer.ts:112-116` —
  case-colliding app usernames mislink Answer accounts; on "exists", verify email
  or salt the slug with the PB user id.
- **T2-8** dead exports: `contracts.ts:34` (`ErrorBody`), `:155`
  (`adminUserPageSchema`), `collections.ts:845` (`SENTINEL_CATEGORY_NAME`).

### PWA stores

- **T2-9** `engine.ts:570-585` — `trackIds` mutates the atom's value in place;
  `set()` no-ops on the same reference (`nanostores` `eq` default is `Object.is`),
  so a future subscriber never fires. **Fix:** copy-on-write
  (`{ ...$syncTombstones.get(), [collection]: [...] }`).
- **T2-10** `engine.ts:180-190` (`pbIdToLocal` → `Object.entries` per call) and
  `:339-346` (`translate` → `find` per event) — O(n²) in hot loops. **Fix:**
  prebuild reverse maps once per pass.
- **T2-11** `engine.ts:335-358` — history adoption leaves permanently dangling
  ids when the referenced item isn't mapped yet; later adoption doesn't
  re-translate. **Fix:** lazy translate via the sync map at read time.
- **T2-12** `reconcile.ts:193-194` + `engine.ts:440-447` — map/journal stamped
  before adoption decides an entry is unusable → perpetual no-op adopts +
  localStorage writes every pass. **Fix:** write map/journal only on successful
  adoption; track pending adoptions.
- **T2-13** `list.ts:30-48, 67-70` — multi-device merge can produce duplicate
  list entries for the same item; `removeFromListByItemId` removes only the
  first. **Fix:** dedupe at adoption (keep oldest `addedAt`).
- **T2-14** `bff-api.ts:90-121` — no fetch timeout; a hung request wedges sync
  (`applying` stays true, `connectPromise` pending). **Fix:** `AbortSignal.timeout`.
- **T2-15** magic strings duplicated: `"http://127.0.0.1:3100"` (`engine.ts:84`,
  `bff-api.ts:13`), `"not signed in"` (`engine.ts:610`, `group-actions.ts:25`,
  mapped in `sync-errors.ts:22`). `sync-errors.ts:51-53` exact-match lookup is
  brittle (wrap prefixes). Engine comments reference `docs/SYNC.md` which does
  not exist.

### Components

- **T2-16** `ui/custom/toggle-tooltip.tsx` — dead code (zero callers) **and**
  imports raw `@ark-ui/react` (violates the wrapper seam; `collection.ts` is the
  only sanctioned Ark import). **Fix:** delete or rebuild on `ui/popover` and
  forward the `open` prop it silently drops.
- **T2-17** `ui/select.tsx:163` — inverted condition:
  `{!heading && <SelectGroupLabel>}` renders the label only when heading is
  absent. Should be `{heading && ...}`.
- **T2-18** `ui/custom/form-dialog.tsx:44-45` — hardcoded English
  `saveLabel="Save"` / `cancelLabel="Cancel"`; every non-English locale shows
  "Cancel". **Fix:** default to `m.save()` / `m.cancel()` (like `confirm-delete.tsx:32`).
- **T2-19** `ui/autocomplete.tsx:80-82` — `AutocompleteCollection` duplicates
  `AutocompleteContent`, zero callers. Dead wrapper boilerplate.
- **T2-20** `back-button.tsx:20-28`, `sync-card.tsx:99-107` — raw `<button>`
  reimplementing focus/hover instead of the app `Button` (`variant="ghost" size="icon-sm"`).
- **T2-21** `menu.tsx:137` — `group-data-[date=open]/trigger-item:bg-accent`
  looks like a typo for `data-[state=open]`; trigger highlight never matches.
- **T2-22** Mixed default/named exports across feature components; `theme-menu.tsx`
  always-truthy `{OPTIONS[mode].Icon && ...}`; `swipeable-item-row.tsx` magic
  `80` duplicated as `w-[80px]`; `item-catalog.tsx:27` fresh array every render
  when `open` is null (memoize); `category-section.tsx:62` `defaultOpen`
  collapsible resets on remount (no persisted accordion state on the catalog page);
  `use-is-mobile.tsx:6,22` layout flash (initial `false`); hardcoded English
  aria-labels in `resizable.tsx:44`, `select.tsx:237`, `dialog.tsx:200`,
  `popover.tsx:90`; ad-hoc `dark:` pairs in `ui/custom/button.tsx:51` (against
  DESIGN.md §7).

### web / admin / common / feedback / config

- **T2-23** `web/src/styles.css:60-65, 84-91` — `brand-logo img` / `hero-logo img`
  selectors are **dead**: the class is on the `<img>` itself, so the hero logo
  renders without radius/shadow. **Fix:** `img.brand-logo` / `img.hero-logo`.
- **T2-24** Three hand-maintained BFF contract copies already drifting (pwa
  `bff-api.ts`, admin `api.ts`, bff `contracts.ts`). **Fix:** share types via a
  type-only `@remindit/bff/api` export (repo already exports `AppType`), or add a
  drift check to `test:pre`.
- **T2-25** `.env.example` comment drift — says "import.meta.env" but web/admin
  use `process.env` (P10 switch); `PUBLIC_BFF_URL` localhost vs 127.0.0.1 mismatch.
- **T2-26** `common/src/models/types.ts:84-91` — docblock says "username is the
  only mandatory field" but the interface requires all five; consumers fabricate
  empty strings. Align type or comment. `frequencyRank` (`:19-20`) silently
  returns -1 for unknown frequencies.
- **T2-27** Root `package.json` — no `preview:web`/`preview:admin`, no root
  `build` for web/admin, `dev:all` omits feedback; `stop:feedback` runs without
  `--env-file`.
- **T2-28** `release.sh` — hardcoded `SERVER`/`REMOTE_WEB_DIR`; uploads the PWA
  artifact to what the comment calls the marketing-site root. Clarify or config.
- **T2-29** `feedback/scripts/setup.ts:91-107` — orphaned temp dir on failure;
  chmod exit code ignored. `stop.ts:41-47` — a successful no-op exits 1 (would
  trip CI); unlink before confirming termination.
- **T2-30** `feedback/scripts/setup.ts:118-124` + `start.ts:14-32` — `FEEDBACK_PORT`
  is baked into `config.yaml` at first setup but the health probe reads `env.port`;
  changing the port hangs 180s. **Fix:** re-render config from env on every setup,
  or fail fast when the config's addr ≠ env.port.
- **T2-31** `web/src/routes/index.tsx:62-67` — "— users" (plural) next to an em-dash
  when the BFF is down. `web/src/styles.css:8` — unused `--accent` token.

---

## Verified-clean (checked, do not re-review)

- PB-rule authz has **no IDOR** in groups/members/notifications; forwarder
  `rewriteLocation` + hop-by-hop stripping is correct and tested.
- `withSuperuser` single-flight + 401-retry (`bff/src/repositories/pocketbase.ts:147-162`) correct.
- Swipe-row, avatar-picker, quick-add tests are meaningful regression tests, not smoke tests.
- Caddyfile ports match all five modules (3000/3100/3200/3300/5555).
- `admin` mount-effect gating is correctly implemented as **UX-only**; the real
  security boundary is server-side (`requireAuth`/`requireAdmin`).
- No hardcoded secrets in `.env.example`, `release.sh`, Caddyfile, or source.
  (T0-8 is about *default fallbacks*, not committed secrets.)

---

## Execution plan

Fix in this order. Update the checkboxes as items land; append a note to the
commit that references `docs/v5-review.md`.

1. **Security** — T0-1 (PB rules + forwarder allowlist + migration + a BFF test
   proving self-promotion is blocked).
2. **Sync-engine races** — T0-2, T0-3, T0-4, T1-1, T1-2, T1-3, T1-4 (session/
   group generation guard; `clearSyncBuffers` in `ensureGroup`; `$now` tick;
   timer re-arm). Add `pwa/tests/stores` coverage for the session-switch and
   group-switch races.
3. **Component bugs** — T0-5, T0-6, T1-11, T1-12, T1-13, T1-14 + a
   `swipeable-item-row` touch test (the single most valuable missing test).
4. **Feedback + env hardening** — T0-7, T0-8, T2-30, T2-29 + `web`/`admin`
   build-time env idiom and `.env.example` cleanup (T0-9).
5. **BFF correctness** — T1-5 → T1-10, then T2-1 → T2-8.
6. **Clean-code pass** — T2-9 → T2-31, batched per module; contract-drift check
   (T2-24) wired into `test:pre`.

Suggested branch policy (AGENTS.md: branch when >10 files change): the full plan
far exceeds 10 files — one feature branch per tier above.