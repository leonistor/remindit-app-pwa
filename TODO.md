# TODO — active work

The working backlog. Product versions and the decision log live in
[docs/ROADMAP.md](docs/ROADMAP.md); the VPS runbook in
[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md). Completed planning material (phases H
hardening, P polish, F product, D deployment, FB feedback, the v5 audit docs)
was disposed 2026-09-04 after shipping — the detail lives in git history
(`TODO.md` before this rewrite, `docs/V5-IMPLEMENTATION.md`,
`docs/v5-review.md`) and in ROADMAP §7's phase notes.

## In flight

- **de/fr/uk translation drafts** — kick-started 2026-09-05 with
  `bun run kickstart:locale` in `common/` (local Ollama, translategemma:12b;
  see `pwa/docs/DEV.md` §Internationalization). The shared-catalog migration's
  `web*` keys were filled in the same pass and **reviewed** the same day (the
  flagged email/device-label nits are fixed). ~40 pre-existing pwa keys across
  the three files still keep English after safety-net rejections (invented/
  renamed `{tokens}`, sentence-fragment keys) — listed in the kickstart output
  and need human review before those locales ship. Shipping caveat: locales in
  `common/project.inlang/settings.json` get compiled by paraglide and
  **auto-served** to matching browsers via the `preferredLanguage` strategy on
  the next release — decide ship order / `APP_LOCALES` gating if the drafts
  aren't reviewed by then. The language selector (`APP_LOCALES`) is still
  en+ro; **web stays baseLocale** (English-only) until the drafts are reviewed
  and the Vite-adapter locale routing lands (see next-session section below).

## Next (V6 + wishlist, roadmap §1)

- [ ] Basic AI features
- [ ] LLM/MCP integration
- [ ] Item attributes (photo / quantity / price)
- [ ] Native app

## Next session: web locale routing — Vite-adapter migration

**Goal:** give `web/` real per-locale URLs (`/ro`, `/de`, `/fr`, `/uk`) so the
translated catalog can actually be *served* (today it only compiles into the
bundles). Blocked on a framework swap: **Paraglide's locale routing rides a
server middleware**, and the current **Rsbuild** adapter has NO user
server-entry hook — `tanstackStart()` auto-injects `server.setup`
(`start-plugin-core/dist/esm/rsbuild/plugin.js:132`) and there is no
`src/server.ts`. The **Vite** adapter requires owning `src/server.ts`, which is
exactly the seam for `paraglideMiddleware` + the router `rewrite`
(`deLocalizeUrl`/`localizeUrl`).

**Verified facts** (all confirmed against installed node_modules, 2026-09-05):
- `@tanstack/react-start` exposes `plugin/vite`; `createStartHandler`/
  `defaultStreamHandler`/`StartServer` ship via `@tanstack/react-start/server`.
- `paraglideVitePlugin` exists in `@inlang/paraglide-js` (already a dep).
- `web/src/paraglide/server.js` is already emitted (no-op under `["baseLocale"]`).
- Vite `preview` serves SSR via `previewServerPlugin` → **deploy launcher
  `infra/bin/start-web.sh` (`bun run preview`) and the bm2 ecosystem stay
  unchanged**.
- Gotcha: vite inlines only `VITE_*` env by default — must set
  `envPrefix: ["PUBLIC_"]` or web silently loses `PUBLIC_BFF_URL`/`PUBLIC_PWA_URL`.

**Staged plan** (each stage gated: `typecheck` ×6 + lint + `build:web` + live
smoke of the 4 routes for SSR/hydration):
1. **Adapter swap, zero behavior change.** Add `vite` + `@vitejs/plugin-react`
   to web deps, remove `@rsbuild/core`/`@rsbuild/plugin-react`; `vite.config.ts`
   with `[tanstackStart(), react(), paraglideVitePlugin(OPTIONS)]` + `envPrefix`;
   new `src/server.ts`, `src/client.tsx`, `src/router.tsx` (routes/`stats.ts`/
   `__root.tsx` carry over; `routeTree.gen.ts` regens, already biome-excluded).
   Keep `strategy: ["baseLocale"]` — output identical to today.
2. **Enable locale routing.** `strategy: ["url", "baseLocale"]` + `urlPatterns`
   (en unprefixed at `/`, then `/ro`, `/de`, `/fr`, `/uk`), router `rewrite`,
   `paraglideMiddleware` in `server.ts`, `routeStrategies` excluding `/_serverFn/*`.
3. **Ship.** Rebuild + `bm2 reload web`; verify prod URLs + canonical/hreflang.
4. **Flip drafts live** (gated on de/fr/uk review) when ready.
**Risks:** React-plugin order (`tanstackStart()` before `react()` on vite —
mirror the official example); server-fn exclusion; `PUBLIC_*` prefix (highest
blast radius — assert stats + PWA URL in a smoke); vite is new to this repo.

## Next session: architecture hardening — module APIs & separation of concerns

**Goal:** close the cross-module contract seams from the 2026-09-05 audit (4
read-only deep-dives across bff/pwa/common/web/admin + direct verification of
every headline). The front-end layers are well-separated (stores→hooks→views,
single `fetch` site, zero `@ark-ui/react` leaks, clean routes→services); the
weak seam is **cross-module contracts — all convention, none compiler-enforced**.
Tests not the focus.

**Verified facts** (audit 2026-09-05, confirmed against source):
- **D8 is practiced by no consumer.** `rg "hc\(|AppType|@remindit/bff" pwa/src admin/src web/src` = 0. pwa hand-re-declares `UserPublic/AuthResponse/Group/Member/Notification`; admin re-declares admin types; web re-types `PlatformStats` + casts.
- **Drift is live, not hypothetical:** pwa `UserPublic` omits `role` (bff `lib/user.ts:13` always sends it); admin drops `AdminUserPage.total` (`bff/src/contracts.ts:154-158`) and invents an inline `{ items }` page type.
- **Phantom deps:** `web/package.json` + `admin/package.json` import `@remindit/common` without declaring it — resolves only via workspace hoist (pwa/bff depend on it).
- **Seed logic ×3:** `pwa/seed/hash.ts` is byte-identical to `common/src/seeds/hash.ts`; `FREQ_TO_DAYS` in `pwa/src/stores/recommender.ts`, `pwa/seed/history.ts`, `common/src/seeds/history.ts`; history simulator ported with a *different default seed* (42 vs 1); avatar duplicated (`common/src/seeds/avatar.ts` ↔ `pwa/src/stores/user.ts`).
- **Root `lint`/`check`/`format` only cover pwa** (`cd pwa && bun run …`) while `biome.json` `files.includes: **`.
- **Sync side-effects at import:** `stores/index.ts` promises no side effects (DEV.md:267), but `export * from "./commands"` → `commands.ts:29` → `sync/engine.ts:87` does `new PocketBase()` + `:128` registers the global token hook at module load.
- **Auth triplication:** BFF accepts Bearer XOR cookie + `X-Session-Token`; the **cookie path has zero consumers** (pwa/admin send Bearer only); pwa vs admin 401 handling diverges (admin clears+redirects, pwa only throws).
- **`scripts/migrate.ts` (398 lines)** is the canonical-diff/migrate engine, untestable in a script; collection names are ~30 literals; `routes/pb.ts:41-55` `SYNC_COLLECTIONS` allowlist can drift from `schema/collections.ts`.

**Execution order** (items 1-4 small/independent/high-value — do first). Each
gated by: root `typecheck`, `lint`, `i18n:check`, relevant tests.
1. **Wire BFF contract types** into pwa + admin as `import type` from `@remindit/bff/api` (type-only, erased — never pulls the server graph; no `hc()` needed). Delete the hand-mirrors; fix `role`/`total` drift it surfaces. Align `bff` `"."`/`"./api"` so a type import can't drag the server bundle.
2. **Declare `@remindit/common` in `web` + `admin`** (`"workspace:*"`).
3. **pwa/seed consume `@remindit/common/seeds`** (hash/history/avatar) + hoist `FREQ_TO_DAYS` into common; add parity test (same input→same output).
4. **Root lint/check/format across all workspaces** (run biome from root, or loop all five like `typecheck`).
5. Lazy-construct the sync PB client inside `initSync()`; consider `src/stores/sync/` → `src/sync/`.
6. Extract `migrate` → `src/schema/reconcile.ts`; export collection-name constants; derive `SYNC_COLLECTIONS` from schema; add per-collection repos (teams/members/notifications).
7. Delete the dead cookie-path or document reserved; unify client 401 policy.
8. Low tier: shared ambient declarations (`*.svg?raw`, one `ImportMeta.env`), `pwa/src/lib/env.ts` config module, `useAdminResource` hook for admin routes, brand-color vars out of `web/src/styles.css`, `NOTIFICATION_TYPES` const, decide response-validate policy (validate all routes or drop ad-hoc parses).

**Done so far:**
- Items 1–4 implemented and shipped (2026-09-05): BFF contract types wired into
  pwa + admin via `@remindit/bff/api` (type-only; `"./api"` now → `contracts.ts`,
  zod-only — never the server graph); hand-mirrors deleted; `role`/`total`
  drift fixed; `@remindit/common` + `@remindit/bff` declared in web/admin/pwa;
  pwa/seed consumes `@remindit/common/seeds` (hash/history/avatar) with
  `FREQ_TO_DAYS` hoisted into common + a seed-parity test; root lint/check/
  format now run biome repo-wide (317 files, was pwa-only 207), which surfaced
  and fixed a `noNonNullAssertion` in `bff/scripts/migrate.ts` and missing
  `<title>` on the brand SVGs.
- Items 5–8 shipped (2026-09-05, same session): the sync PB client is now a
  lazy singleton (`getPb()` — no `new PocketBase()`/hook wiring at module
  load; import-only contract test); migrate engine extracted to testable
  `src/schema/reconcile.ts` with `COLLECTION_NAMES` constants driving both the
  builders and the derived `SYNC_COLLECTIONS` forwarder allowlist; per-collection
  repos (teams/members/notifications) route services off raw SDK calls; client
  401 policy unified (pwa signs out via a `setUnauthorizedHandler` hook, cookie
  transport documented-reserved for web SSR auth); low-tier: `pwa/src/lib/env.ts`
  centralizes `import.meta.env` reads, web brand CSS vars now injected from
  `@remindit/common/brand`, `useAdminResource` hook for the three admin list
  dashboards, `NOTIFICATION_TYPES` const in common, and a decided
  response-validation policy (every contract-shaped route response zod-parsed).
  Commits: `3b9f56d`, `d38d96d`, `0f81ee8`, `de29b80`, `75df77b`, `1ccd7fd`,
  `b715eb7`. Ambient-decl sharing (item 8a) was evaluated and NOT done: TS only
  applies ambient declarations from files in a module's own program, so each
  consumer needs its `*.svg?raw` copy — common's copy is the authoritative one.

## Deferred (by decision — revisit when triggered)

- **Notifications hardening** — when Web Push or digests arrive: typed `type`
  enum + discriminated payload in contracts, `dedupeKey` + `(user, created)`
  indexes via the idempotent migrate, paginated list (today: plain-text types,
  untyped payload, unpaginated `getFullList`).
- **Old host** — optional 301 `remindit.parsedwink.com` → `remindit.me`.
- **`pbtsdb` re-evaluation** — if TanStack DB ships GA offline persistence.

## Evaluated & rejected (2026-09-03)

- **`nathanstitt/pbtsdb`** (TanStack DB adapter for PocketBase; MIT, active,
  v0.7.2, 26★) — the only credible one. Not adopted: it's a remote-as-source-
  of-truth model (TanStack Query cache + optimistic overlay + realtime),
  while the pwa is local-first (device data is the source of truth offline;
  journal + three-way LWW + tombstones per `pwa/docs/SYNC.md`). Adopting it
  means replacing the nanostores layer + tested sync engine with a
  React/TanStack stack (4 new peer deps) for functional parity at best.
  **Re-evaluate** if TanStack DB ships GA offline persistence.
- **`Daniels-not/usemoor`** (offline-first optimistic hooks) — skip: v0.2.2,
  1★, single author, entire history in one commit burst (2026-07-30);
  whole-list resync per change (their own stated limit) vs the pwa's targeted
  reconcile; conflict resolution is local-wins only — a downgrade from the
  existing journal/LWW engine.
- **`KevinBonnoron/pocketbase-react-hooks`** — skip: dormant since 2025-12,
  and its `useAuth` wraps `pb.authStore` directly, bypassing the BFF auth
  contract (rotating tokens, cookie transport, D2/D8 layering). Duplicates
  what `pwa` stores + `bff` already do.
