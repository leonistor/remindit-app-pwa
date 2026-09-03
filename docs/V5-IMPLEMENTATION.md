# V5 Audit Implementation Plan

Source: `docs/v5-review.md`
Created: 2026-09-04
Status: ✅ ALL PHASES COMPLETE

## Decisions

- **Forwarder allowlist scope**: Include all collections (sync + auth + realtime)
- **Env default pattern**: Keep dev defaults, gate behind `NODE_ENV !== "production"`, throw in prod
- **Rate limiting**: Use `hono-rate-limiter` (in-memory store, no Redis)
- **Contract sharing**: Subpath export from `bff` (`@remindit/bff/api`)
- **Branch**: Work directly on main
- **Tests**: Focus on Tier 0 security/data-loss + sync-engine races

## Execution Order

### Phase 1 — Security / Data Loss (T0-1 through T0-9) ✅

- [x] **T0-1** Privilege escalation via `/pb` forwarder
  - `bff/src/schema/collections.ts` — PB rules: `createRule`, `updateRule`, hide `role`
  - `bff/src/routes/pb.ts` — Forwarder allowlist (`SYNC_COLLECTIONS` set)
  - `bff/tests/forwarder-security.test.ts` — 19 tests proving self-promotion blocked
- [x] **T0-2** `ensureGroup` silent data loss
  - `pwa/src/stores/sync/engine.ts` — Clear buffers before re-pointing
- [x] **T0-3** `runConnect` resurrects torn-down session
  - `pwa/src/stores/sync/engine.ts` — Session generation counter
- [x] **T0-4** `switchGroup` reuses stale connect
  - `pwa/src/stores/sync/engine.ts` — Re-read `$syncGroup` after each await
- [x] **T0-5** Swipe row tap opens edit dialog
  - `pwa/src/components/catalog/swipeable-item-row.tsx` — `onClickCapture` + `stopPropagation`
- [x] **T0-6** Swipe row fast fling bounces back
  - `pwa/src/components/catalog/swipeable-item-row.tsx` — Track offset in ref
- [x] **T0-7** Feedback i18n bundles not version-keyed
  - `feedback/scripts/setup.ts` — Always re-extract on setup
- [x] **T0-8** Default admin passwords in production
  - `bff/src/env.ts`, `feedback/src/env.ts` — Gate behind `NODE_ENV`
- [x] **T0-9** Build-time env binding ships localhost fallbacks
  - `web/src/lib/stats.ts`, `admin/src/lib/api.ts`, `web/src/routes/*` — `import.meta.env` idiom
  - `.env.example` — Added production URL comments

### Phase 2 — Sync Engine Races (T1-1 through T1-4) ✅

- [x] **T1-1** In-flight reconcile re-reads stale `$syncMap`
  - `engine.ts` — Snapshot `groupId` at pass start, skip persist if changed
- [x] **T1-2** Notifications stale after sign-out/account switch
  - `notifications.ts` — Capture `session.userId`, bail if changed
- [x] **T1-3** `$recommendations` overdue badges go stale
  - `selectors.ts` — `$now` minute-tick atom (60s, visibility-aware)
- [x] **T1-4** Profile push timer one-shot consumed
  - `engine.ts` — Removed `applying` guard from subscribe callback

### Phase 3 — BFF Correctness (T1-5 through T1-10) ✅

- [x] **T1-5** Owner-membership create failure → ownerless teams
  - `bff/src/services/groups.ts` — Delete team on membership failure
- [x] **T1-6** `deleteUser` orphan-locks teams
  - `bff/src/services/admin.ts` — Reject if user owns teams
- [x] **T1-7** No rate limiting on login/register
  - `bff/src/routes/auth.ts` — `hono-rate-limiter` (20 req/15min per IP)
- [x] **T1-8** SENTINEL_CATEGORY_NAME never provisioned
  - `bff/src/services/groups.ts` — Provision in `create`
- [x] **T1-9** `listMembers` returns 200 to non-members
  - `bff/src/services/groups.ts` — Pre-flight team getOne
- [x] **T1-10** PB field-level validation leaks internals
  - `bff/src/lib/pb-error.ts` — Strip `details` from error body

### Phase 4 — Component Bugs (T1-11 through T1-14) ✅

- [x] **T1-11** Shopping list double-tap + timer leak
  - `pwa/src/components/shopping-list-panel.tsx` — VT sentinel + unmount cleanup
- [x] **T1-12** Unhandled transition.finished rejection
  - `pwa/src/hooks/use-item-travel-transition.ts` — `.catch(() => {})` before `.finally()`
- [x] **T1-13** Failed markRead silently swallowed
  - `pwa/src/components/notifications-card.tsx` — catch + console.warn
- [x] **T1-14** Dead AlertDialog that can never open
  - `pwa/src/components/catalog/category-items-table.tsx` — Remove duplicate, share single dialog

### Phase 5 — Clean Code Pass (T2-1 through T2-31) ✅

- [x] **T2-1** `toPublicUser` triplicated — extract shared helper
- [x] **T2-2** Admin routes manual query parsing — add Zod validatedQuery
- [x] **T2-3** Unbounded `getFullList` — paginate/cap
- [x] **T2-4** LWW compares timestamps as strings — `Date.parse` both sides
- [x] **T2-5** `items[0]` unconditional dereference — guard
- [x] **T2-6** SSE no abort handling — add disconnect handler
- [x] **T2-7** Case-colliding Answer usernames — salt with PB user id
- [x] **T2-8** Dead exports — remove
- [x] **T2-9** `trackIds` mutates atom in place — copy-on-write
- [x] **T2-10** O(n²) in hot loops — prebuild reverse maps
- [x] **T2-11** History adopt dangling ids — empty string for untranslated
- [x] **T2-12** Map/journal stamped before adoption decides — write only on success
- [x] **T2-13** Multi-device duplicate list entries — dedupe at adoption
- [x] **T2-14** No fetch timeout — `AbortSignal.timeout`
- [x] **T2-15** Magic strings — extract constants
- [x] **T2-16** `toggle-tooltip.tsx` dead code — delete
- [x] **T2-17** `select.tsx` inverted condition — fix
- [x] **T2-18** `form-dialog.tsx` hardcoded English — i18n
- [x] **T2-19** `AutocompleteCollection` dead wrapper — delete
- [x] **T2-20** Raw `<button>` — use `<Button>`
- [x] **T2-21** `menu.tsx` typo — fix
- [x] **T2-22** Various small fixes
- [x] **T2-23** CSS selectors dead — fix
- [x] **T2-24** Contract types drift — already set up (skip)
- [x] **T2-25** `.env.example` comment drift — already clean (skip)
- [x] **T2-26** `UserProfile` type vs docblock — align
- [x] **T2-27** Missing root scripts — add
- [x] **T2-28** `release.sh` hardcoded — parameterize
- [x] **T2-29** Feedback scripts orphaned temp / exit code — fix
- [x] **T2-30** Feedback config not re-rendered — fix
- [x] **T2-31** Stats pluralization — already handled (skip)

## Test Plan

| Area | Tests | File | Status |
|------|-------|------|--------|
| T0-1 | Forwarder allowlist + PB rules | `bff/tests/forwarder-security.test.ts` | ✅ 19 tests |
| T0-2 | `ensureGroup` clears buffers | `pwa/tests/stores/sync-engine.test.ts` | ✅ |
| T0-3 | `runConnect` aborts on session change | `pwa/tests/stores/sync-engine.test.ts` | ✅ |
| T0-4 | `switchGroup` doesn't reuse stale connect | `pwa/tests/stores/sync-engine.test.ts` | ✅ |
| T1-7 | Rate limiter blocks after N | `bff/tests/rate-limiter.test.ts` | ⏳ Phase 3 |
| T0-5/6 | Swipe row behavior | `pwa/tests/components/swipeable-item-row.test.ts` | ⏳ Phase 4 |

## Verification (after each phase)

```bash
bun run typecheck    # root
bun run lint         # root
bun run test         # pwa
bun run test:bff     # bff
bun run build        # pwa
```
