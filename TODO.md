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
  screenshots; release-gate `test:pre` green. Commit + tag are local — push
  and the server deploy are the D4 step.
- [x] **F4** Notifications channel decision (D4) — Web Push vs email vs
  realtime-only; then dispatch in the bff + the in-app consumer. Done
  2026-09-03 (in-app realtime; Web Push deferred, email rejected — D4 row
  updated): BFF dispatches `member.added`/`member.left`/`member.removed`
  superuser-side from the groups service (best-effort, pre-fetch before
  delete so self-leavers can't 404 the dispatch); pwa `$notifications` store
  + user-scoped realtime subscription in the engine + Profile card with
  mark-read; en/ro. Plain text types, untyped payload (minimal groundwork —
  a future push/digest design adds the typed enum + dedupeKey migration).

## Phase D — platform deployment (unblocks V6)

**Gated on deployment research (2026-09-03):** process-manager + backup
choices for the VPS (D1) need a research pass before any of D1–D4 start;
nothing is pushed yet (local commits through v5.0.0).

- [ ] **D1** VPS process manager for the bff (Hono + PB), automated
  `pb_data/` backups (PB built-in backup endpoints / MCP `pb_backup`).
- [ ] **D2** Deploy `web/` + `admin/` SSR bundles behind the reverse proxy
  (D3); protect the admin origin (VPN / IP allowlist / basic auth).
- [ ] **D3** Prod env plumbing: `SESSION_COOKIE_SECURE`, `CORS_ORIGINS`
  allowlist with real origins, `PUBLIC_PWA_URL` / `PUBLIC_BFF_URL` /
  `PUBLIC_FEEDBACK_URL` values.
- [ ] **D4** Deploy the current pwa bundle (SW-safe release flow, see
  `pwa/docs/DEPLOY.md`).

## Phase FB — feedback module (V6 feedback capture) — setup + bridge done 2026-09-03

Apache Answer sidecar (`feedback/`, branch `feat/feedback`): setup/start/stop
scripts + Caddy host + one-way user bridge (register hook + backfill).
Deferred follow-ups:

- [x] **FB1** Footer links — `target=_blank` to the feedback URL from the pwa
  (`pwa/src/components/footer.tsx`) and web (`web/src/routes/__root.tsx`)
  footers; `PUBLIC_FEEDBACK_URL` env + en/ro strings. Both render the link
  only when set (no localhost fallback in prod — pwa fallback removed
  2026-09-03, H15-class).
- [ ] **FB2** Submit API — params `from_module=pwa|web`, route, user, text;
  BFF-mediated post into Answer.
- [ ] **FB3** Tags — seed `bug`, `feature-request`, `discussion`,
  `development` (docs/FEEDBACK.md).
- [ ] **FB4** Plugin quick-links (apache/answer-plugins quick-links) + links
  to bug / feature-request / discussion.
- [ ] **FB5** Login story for bridged users (SSO / email-invite) — they are
  provisioned with undisclosed throwaway passwords today.
- [ ] **FB6** Branding from `@remindit/common` (logo, colors) in the Answer
  theme.

---

## Known edges (non-blocking, surfaced by review)

- **`switchGroup` in-flight-connect race** — a switch landing while a connect
  is already in flight reuses that connect (H3 serialization); the old
  group's realtime subscription can survive until the next
  foreground/heartbeat reconnect. Self-healing; reconcile output stays
  correct. Harden by cancelling/awaiting the in-flight connect in the switch
  path.
- **Cancelable in-flight reconciles** — the last wipe edge case from the
  Phase H review (reconcile racing `wipeAllData`). Carried since then; the
  `applying` flag prevents stacking but doesn't cancel.
- **Notifications groundwork deferred (minimal by decision, D4)** — plain
  text types + untyped payload, no dedupe key, `getFullList` without
  pagination. When Web Push or digests arrive: typed `type` enum +
  discriminated payload in contracts, `dedupeKey` + `(user, created)` indexes
  via the idempotent migrate, paginated list.

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
