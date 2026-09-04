# TODO — active work

The working backlog, sequenced. Ships-and-status live in
[docs/ROADMAP.md](docs/ROADMAP.md) (product versions + platform decision log);
this file records what is in flight. One feature branch per phase-theme; run
the verification gates before merging (typecheck, lint, module suites).

The Phase H list came from a full code review (2026-09-03, all 5 modules —
pwa, bff, web, admin, common). Locations are `file:line` at review time.

---

## Phase H — hardening (review follow-ups) — done 2026-09-03

Highest-signal findings; shipped as one hardening slice. Follow-ups that
surfaced during implementation: the pwa sync client should persist the
`X-Session-Token` header (bff now delivers it — P9-adjacent), and cancelable
in-flight reconciles would close the last wipe edge case.

### pwa sync engine (data-loss class)

- [x] **H1** Merge `diffCollection`'s returned map/journal back into the sync
  maps — `pwa/src/stores/sync/engine.ts:341` keeps only `result.actions`, so a
  remote-win leaves the journal stale and the *next* local edit to that record
  is silently discarded (remote re-wins). Also loses the vanished-record
  pruning → repeated no-op deletes. Fix: assign
  `maps.map[collection] = result.map; maps.journal[collection] = result.journal`
  before executing actions.
- [x] **H2** `wireStoreListeners()` re-entrancy guard — `engine.ts:587`:
  every `connect()` (load, sign-in, each `online` event) re-subscribes and
  stacks listeners. Wire once behind a module flag or honor the unsubscribes.
- [x] **H3** Serialize `connect()` — `engine.ts:528`: `ensureGroup`
  (listGroups → createGroup) races with a second connect and can create
  duplicate groups. Guard like the existing `applying` flag.
- [x] **H4** `wipeAllData()` must sign out first — `pwa/src/stores/commands.ts:86`:
  `localStorage.clear()` wipes the sync session/journal while in-memory
  listeners still fire → tombstones → a debounced reconcile deletes the whole
  shared group remotely. Clear the session + unsubscribe (sign out) inside the
  wipe.
- [x] **H5** Foreground + interval reconcile — `engine.ts:690` wires only
  `online`; `pwa/docs/SYNC.md:77` promises foreground + 60s interval. Add
  `visibilitychange` + interval (or correct SYNC.md).
- [x] **H6** Engine-level test with a stubbed PB/BFF client — only the pure
  diff (`tests/stores/sync-reconcile.test.ts`) is tested today; H1–H3 live in
  the untested orchestration layer.

### bff auth & forwarder

- [x] **H7** Deliver the rotated token — `bff/src/middleware/auth.ts:44`:
  every request pays a PB `auth-refresh` round trip but the fresh token is
  never returned (no header, cookie only re-issued at login), so all sessions
  expire at the original 14-day TTL despite `bff/docs/API.md`'s claim. Fix:
  `X-Session-Token` response header or re-issue the cookie per authenticated
  response; consider refreshing only near `exp`.
- [x] **H8** PB outage must be 503, not 401 — `middleware/auth.ts:51`: a fetch
  throw (PB down) is answered as invalid-token and clients discard valid
  credentials during infra blips.
- [x] **H9** Forwarder abort/timeout wiring — `bff/src/routes/pb.ts:40`: pass
  `c.req.raw.signal` upstream (client disconnect cancels; SSE-safe) and add a
  timeout for non-streaming methods.
- [x] **H10** Validation errors must match the published error contract —
  `@hono/zod-validator`'s default 400 body (`{ success, error: ZodError[] }`)
  differs from the published `{ error, details }` shape (`bff/src/contracts.ts:30`).
  Add a custom `zValidator` hook returning the contract shape.

### admin

- [x] **H11** Create-user modal — `admin/src/routes/users.tsx:136`: plain
  button outside a `<form>` so `required`/`type="email"`/`minLength` never
  fire; `admin/src/lib/api.ts:57` puts an object into `Error` → UI shows
  "[object Object]". Wrap in `<form onSubmit>` + coerce the error.
- [x] **H12** Session expiry strands the user — `api.ts:101`: on 401 the token
  is cleared and an error shown, but no redirect to `/login` and the nav keeps
  the signed-in links. Redirect on `AdminApiError` 401.
- [x] **H13** Overview page fires a doomed request when signed out —
  `admin/src/routes/index.tsx:18` lacks the `if (!getToken()) return` guard
  its siblings (`users.tsx:41`, `groups.tsx:19`) have.
- [x] **H14** Delete the dead, drifted `LoginResponse` type — `api.ts:101`
  (login.tsx inlines its own shape).

### web

- [x] **H15** Download CTA must never fall back to `http://localhost:3000` —
  `web/src/routes/download.tsx:20` renders localhost copy if
  `PUBLIC_PWA_URL` is unset at deploy time. Render the CTA conditionally
  instead.
- [x] **H16** Nav uses plain `<a href>` — `web/src/routes/__root.tsx:64`:
  full document reloads between routes in a TanStack Start app. Use `Link`
  (admin's `__root.tsx` already does).

**Gate:** `bun run typecheck` + `bun run lint` + `bun run test:pre` (pwa) +
`bun run test:bff` green.

---

## Phase P — polish (review nice-to-haves)

- [x] **P1** bff: cache the superuser client, re-auth on 401 —
  `bff/src/services/admin.ts`, `stats.ts` re-auth per call. Done 2026-09-03:
  cached singleton + single-flight auth + `withSuperuser` 401-only retry;
  services migrated, `feedback.ts`/scripts keep `forSuperuser` (also cached).
- [x] **P2** bff: move the middleware's inline auth-refresh fetch into the
  repository layer (D8 strictness) — `middleware/auth.ts:51`. Already
  satisfied by the H7/H8 rewrite: `authRefresh` lives in
  `repositories/pocketbase.ts` since f504aac; no `fetch(` remains in
  `bff/src/middleware/` (verified 2026-09-03).
- [x] **P3** bff forwarder: rewrite/strip `location` on 3xx (would leak the
  internal PB URL), enumerate verbs instead of `.all` (`routes/pb.ts:28,46`).
  Done 2026-09-03: GET/POST/PATCH/DELETE enumerated (+405 fallback with
  `Allow`), `rewriteLocation` re-prefixes internal redirects onto the
  client-facing `/pb` origin and strips third-party/unparseable ones.
- [x] **P4** bff tests: cookie-auth path, CORS allowlist behavior, `DELETE
  /api/admin/groups/:id`, forwarder PUT/PATCH/DELETE + query forwarding, admin
  create-admin role escalation. Done 2026-09-03: cookie fast-path + Bearer
  precedence, CORS allowlist unit suite, admin group delete (+404 pin),
  end-to-end admin-role escalation, query forwarding (PUT/PATCH/DELETE had
  already landed with P3).
- [x] **P5** pwa sync: emit `heal` only on actual journal change
  (`reconcile.ts:130`), exclude `history_events` from store-change-triggered
  reconciles, reset `lastSeenIds` on signOut (`engine.ts:93`), remove the
  no-op `bffApi.me` call in `signOut` (`engine.ts:657`). Done 2026-09-03:
  heal-on-change in both branches (+ persist guard for tombstone-only passes),
  history watch removed (interval/realtime still push), `lastSeenIds` cleared
  on signOut; the sign-out `bffApi.me` was already gone. Note: SYNC.md's
  trigger list doesn't mention the history exclusion yet.
- [x] **P6** pwa: remove unreachable drawer machinery —
  `components/drawer-context.tsx`, `components/item-detail-drawer.tsx`, the
  `$itemDetail` LRU in `stores/selectors.ts:324` (~80 lines of dead UI). Done
  2026-09-03: also removed the now-consumer-less Shark `ui/drawer.tsx`
  (re-addable via `bunx shadcn add @shark/drawer`), orphaned
  `itemDetails`/`itemDetailsHint` i18n keys, and the stale DEV.md/DESIGN.md
  references.
- [x] **P7** pwa: map `sync.lastError`/BFF messages to paraglide messages
  (`components/sync-card.tsx:64,89`); i18n the "Loading…" fallback
  (`router.tsx:60`). Done 2026-09-03: `lib/sync-errors.ts` maps the published
  BFF contract strings (+ engine throw, fetch TypeError) to 8 `syncError*`
  keys with a generic fallback; router fallback reuses the existing `loading`
  key.
- [x] **P8** admin: fetch timeout in `api()` (web uses `AbortSignal.timeout`);
  busy-guard the delete buttons (`users.tsx`, `groups.tsx`). Done 2026-09-03:
  10s timeout → `AdminApiError` 408 (browser/undici abort shapes both
  handled, caller signals combined); per-row `deletingId` guard placed before
  the confirm dialog, in-flight row `loading` + all rows `disabled`.
- [x] **P9** pwa: align the token-rotation comment with reality or implement
  header capture — `stores/sync/session.ts:1` vs `engine.ts:552`. Done
  2026-09-03 (implemented, not just the comment): `X-Session-Token` capture on
  both response paths (pb `afterSend` + injected bff-api handler — stores →
  lib layering), `patchSessionToken` with a same-token loop guard, authStore
  kept fresh. Sessions now outlive the original login token's TTL.
- [x] **P10** Pick one env-access convention for the Rsbuild modules
  (`process.env` vs `import.meta.env`) — web uses the former, admin the
  latter. Done 2026-09-03: `process.env` everywhere (root AGENTS.md's
  documented convention); admin's `base()` switched, dead `ImportMeta.env`
  declaration removed, build verified to inline the real value (fallback
  DCE'd).
- [x] **P11** bff integration tests accumulate fixture users forever —
  `admin.integration.test.ts` pulled `perPage=200` assuming the fixture is in
  the page; the instance crossed 200 users (flake hit 2026-09-03, fixtures
  pruned by hand). Fixed: `listUsers` gained a `filter` param and the test
  scopes to its fixture username.

---

## Phase F — product (V5 completion, roadmap §1)

- [x] **F1** Group sharing UI in the pwa — join an existing group / share a
  list with another user; today `ensureGroup` always makes a private
  "My list" (`pwa/src/stores/sync/engine.ts:528`). Needs a group picker +
  invite flow against `/api/groups*`. Done 2026-09-03: `SharedListCard` on
  Profile (group switcher with owner markers) wired through the
  `groupActions` wrappers (`stores/sync/group-actions.ts`, token pulled from
  `$syncSession`) over the engine `switchGroup`/`recoverActiveGroup` and the
  bff membership endpoints; lookup-404 and not-a-member surfaced as
  dedicated `sharedList*` messages.
- [x] **F2** Surface roles in-app (owner / member), leave/remove member flows.
  Done 2026-09-03: role badges per member row, owner-gated invite (by exact
  username) and remove, self-leave behind an alert-dialog confirm; both flows
  call `recoverActiveGroup()` (no-op while the group is still valid) then
  refresh; en/ro strings under the `sharedList*` family.
- [x] **F3** Release the sync slice as the next pwa release (sync engine +
  auth UI are on main since phase 5, unreleased at v4.4.0). Done 2026-09-03:
  tagged v5.0.0 (major, mirroring roadmap V5) — changelog, About/Help sync +
  shared-list sections (en/ro), DEPLOY.md build-time env note, regenerated
  screenshots; release-gate `test:pre` green. Commit + tag pushed to origin
  2026-09-04; the server deploy is the D4 step.
- [x] **F4** Notifications channel decision (D4) — Web Push vs email vs
  realtime-only; then dispatch in the bff + the in-app consumer. Done
  2026-09-03 (in-app realtime; Web Push deferred, email rejected — D4 row
  updated): BFF dispatches `member.added`/`member.left`/`member.removed`
  superuser-side from the groups service (best-effort, pre-fetch before
  delete so self-leavers can't 404 the dispatch); pwa `$notifications` store
  + user-scoped realtime subscription in the engine + Profile card with
  mark-read; en/ro. Plain text types, untyped payload (minimal groundwork —
  a future push/digest design adds the typed enum + dedupeKey migration).

## Phase D — platform deployment (unblocks V6) + Feedback module

**Process manager chosen: [bm2](https://github.com/Bunsgate/bm2) (Bun-native PM2
replacement, pinned `1.1.0)** — fits the all-Bun stack, one ecosystem file for
the whole topology, built-in health checks / log rotation / zero-downtime reload
/ reboot persistence / Prometheus. Backups are a separate systemd-timer job (bm2
does not handle them). The Feedback module (Apache Answer sidecar) is deployed
alongside the platform — same bm2 ecosystem, same Caddy host. Repo scaffolding
for D1–D5 is in place: `infra/ecosystem.config.ts` + `infra/bin/start-*.sh`,
`bff/scripts/{serve,backup}-pb.ts`, `infra/Caddyfile`,
`infra/backup.{service,timer}`, `docs/DEPLOY-VPS.md`, prod `allowedHosts` +
`.env.example` values, and `feedback` wired into `dev:all`. Local commits
through v5.0.0; VPS provisioning not yet done.

- [ ] **D1** VPS: `bun add -g bm2`, `bm2 start infra/ecosystem.config.ts` →
  `save` → `startup install`; verify all 5 online (pb, bff, web, admin,
  feedback) + reboot persistence. Automate `pb_data/` backups via
  `infra/backup.{service,timer}` (local snapshots, `PB_BACKUP_KEEP` retained).
  **Back up the feedback module's `answer-data/` alongside `pb_data/`** (same
  timer / strategy). Done 2026-09-04 (code side, decision recorded):
  `feedback/scripts/backup-answer.ts` snapshots the live sqlite via `VACUUM
  INTO` (page-consistent against a live writer; Bun 1.4.1 has no
  `db.backup()` — verified) + `quick_check` validation, tars snapshot +
  uploads/config with `ANSWER_BACKUP_KEEP` retention; wired best-effort into
  `infra/bin/backup.sh` before the PB backup (a feedback-side failure never
  blocks `pb_data/`). Local archive + restore round-trip verified. The VPS
  provisioning itself is the remaining D1 work.
- [ ] **D2** Build + deploy `web/` + `admin/` SSR behind Caddy
  (`www.remindit.me` / `admin.remindit.me`); protect admin origin (basicauth +
  IP allowlist in `infra/Caddyfile`). DNS A records for the subdomains go in
  first (Caddy needs them for cert issuance — decided 2026-09-04); the apex
  moves last, as the D4 cutover.
- [ ] **D3** Prod env plumbing on the VPS repo-root `.env`:
  `SESSION_COOKIE_SECURE=true`, `CORS_ORIGINS` real origins,
  `PUBLIC_PWA_URL=https://remindit.me` / `PUBLIC_BFF_URL=https://api.remindit.me`
  / `PUBLIC_FEEDBACK_URL=https://feedback.remindit.me`.
- [ ] **D4** Deploy current pwa bundle to `remindit.me` (SW-safe release flow,
  `pwa/docs/DEPLOY.md`); DNS cutover from `remindit.parsedwink.com`.
- [ ] **D5** Deploy the Feedback module (Apache Answer) as part of the platform
  rollout: bm2-managed `feedback` process + Caddy host `feedback.remindit.me`
  (already in `infra/Caddyfile`), run in `dev:all`. FB2–FB6 remain deferred
  product work (submit API, tags, plugins, login story, branding).

## Phase FB — feedback module (V6 feedback capture) — done 2026-09-04

Deployment of the feedback module is folded into Phase D (D5): same bm2
ecosystem + Caddy host `feedback.remindit.me` as the rest of the platform, and it
runs in `dev:all`. All items below shipped 2026-09-04 as one slice (branch
`feat/feedback`, uncommitted at write time). Live-verified against the running
Answer sidecar: Answer ignores the `username` field and derives the username
from `display_name` (preserving underscores) — the bridge uses
`canonicalAnswerUsername` (slug of record.username, no salt); `listTags` needs
`page=1`; the activation route is `user/activation` (singular — the swagger's
plural `users/activation` returns the SPA shell and never reaches the handler);
question content min is 6.

Apache Answer sidecar (`feedback/`, branch `feat/feedback`): setup/start/stop
scripts + Caddy host + one-way user bridge (register hook + backfill). Shipped:

- [x] **FB1** Footer links — `target=_blank` to the feedback URL from the pwa
  (`pwa/src/components/footer.tsx`) and web (`web/src/routes/__root.tsx`)
  footers; `PUBLIC_FEEDBACK_URL` env + en/ro strings. Both render the link
  only when set (no localhost fallback in prod — pwa fallback removed
  2026-09-03, H15-class).
- [x] **FB2** Submit API — `POST /api/feedback` (authenticated, from pwa/web)
  and `POST /api/feedback/guest` (public, web form). BFF-mediated post into
  Answer as the user's twin (deterministic HMAC password from
  `ANSWER_BRIDGE_SECRET` — reset → login → create question) or the shared
  `web-guest` twin. `X-Session-Token`-safe, rate-limited (10/15 min), errors
  mapped 503 (Answer down) / 502 (Answer rejected). Contracts + service in
  `bff/src/contracts.ts` / `services/feedback.ts` / `routes/feedback.ts`.
- [x] **FB3** Tags — `bun run configure:feedback tags` seeds `bug`,
  `feature-request`, `discussion`, `development` idempotently (docs/FEEDBACK.md
  descriptions). Question content min raised to 6 to match Answer's validator.
- [x] **FB4** Quick-links — plugin path rejected (Answer plugins must be
  compiled into the binary — no runtime install). Shipped as tag-filtered
  footer deep links (`/questions?tag=bug|feature-request|discussion`) in the
  pwa + web footers, gated on `PUBLIC_FEEDBACK_URL`.
- [x] **FB5** Login story — SMTP config via `configure:feedback smtp` (Inbucket
  dev host `maildev.parsedw.ink:2500` in `.env`/`.env.example`; mailbox naming
  is `domain` — messages for `x@remindit.local` appear under the
  `remindit.local` mailbox on the Inbucket web UI), `POST /api/feedback/activate`
  + pwa "Email me a login link" action. Activation e2e-verified live
  2026-09-04: the singular `user/activation` route emails the "Confirm your new
  account" link and it lands in Inbucket.
- [x] **FB6** Branding from `@remindit/common` — `configure:feedback branding`
  sets site name/description, theme `primary_color` (`BRAND_COLOR`) and custom
  CSS via the admin API; logo documented as manual (the ~4 KB SVG exceeds
  Answer's 512-char branding-URL cap).

Gate: root `typecheck` + `lint` clean; `test:bff` 156 pass; web build green;
`test:quick` has one PRE-EXISTING failure (`sync-engine.test.ts` concurrent
connects — reproduced without this slice, untouched). `hono-rate-limiter`
declared in `bff/package.json` (was used-but-undeclared).

---

## Known edges (non-blocking, surfaced by review)

- [x] **`switchGroup` in-flight-connect race** — a switch landing while a connect
  is already in flight reuses that connect (H3 serialization); the old
  group's realtime subscription can survive until the next
  foreground/heartbeat reconnect. Self-healing; reconcile output stays
  correct. Done 2026-09-04: `ensureGroup` now compare-and-sets `$syncGroup`
  (a concurrent switch's repoint is never clobbered) and `runConnect`
  continues for the CURRENT group instead of bailing when a switch lands
  mid-connect — the switch's group gets its reconcile + realtime wired
  immediately. Deterministic engine test added.
- [x] **Cancelable in-flight reconciles** — the last wipe edge case from the
  Phase H review (reconcile racing `wipeAllData`). Carried since then; the
  `applying` flag prevents stacking but doesn't cancel. Done 2026-09-04:
  `reconcileCollection` returns early at the next action boundary when the
  session/group is torn down mid-pass (sign-out / wipe / switch), and
  `reconcileAll` aborts the pass (no profile push, no "online" status) when a
  collection reports the cancellation.
- **Notifications groundwork deferred (minimal by decision, D4)** — plain
  text types + untyped payload, no dedupe key, `getFullList` without
  pagination. When Web Push or digests arrive: typed `type` enum +
  discriminated payload in contracts, `dedupeKey` + `(user, created)` indexes
  via the idempotent migrate, paginated list.

Also closed 2026-09-04: the pre-existing `test:quick` failure
(`sync-engine.test.ts` "concurrent connects create the group exactly once" —
`groupsCreated` was 0 because the second concurrent `signIn` bumped
`sessionGeneration` and aborted the shared in-flight connect). Fix:
`signIn`/`signUp` now bump the generation only when the session identity
actually changes (`applySession`), so identical concurrent connects reuse the
in-flight one. `test:quick` (256) + full pwa suite (313) green; lint warnings
in the engine test file cleared.

---

## Later (roadmap §1 V6 + wishlist)

Community & feedback capture (phase FB above), basic AI features, LLM/MCP
integration; item attributes (photo/quantity/price), native app, notifications
& live updates.

### Evaluated & rejected (2026-09-03)

- **`nathanstitt/pbtsdb`** (TanStack DB adapter for PocketBase; MIT, active,
  v0.7.2, 26★) — the only credible one. Not adopted: it's a remote-as-source-
  -of-truth model (TanStack Query cache + optimistic overlay + realtime),
  while the pwa is local-first (device data is the source of truth offline;
  journal + three-way LWW + tombstones per `pwa/docs/SYNC.md`). Adopting it
  means replacing the nanostores layer + tested sync engine with a
  React/TanStack stack (4 new peer deps) for functional parity at best.
  **Re-evaluate** if TanStack DB ships GA offline persistence or when building
  the V5 sharing UI from scratch.
- **`Daniels-not/usemoor`** (offline-first optimistic hooks) — skip: v0.2.2,
  1★, single author, entire history in one commit burst (2026-07-30);
  whole-list resync per change (their own stated limit) vs the pwa's targeted
  reconcile; conflict resolution is local-wins only — a downgrade from the
  existing journal/LWW engine.
- **`KevinBonnoron/pocketbase-react-hooks`** — skip: dormant since 2025-12,
  and its `useAuth` wraps `pb.authStore` directly, bypassing the BFF auth
  contract (rotating tokens, cookie transport, D2/D8 layering). Duplicates
  what `pwa` stores + `bff` already do.
