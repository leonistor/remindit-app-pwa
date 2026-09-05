# TODO — active work

The working backlog. Product versions and the decision log live in
[docs/ROADMAP.md](docs/ROADMAP.md); the VPS runbook in
[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md). Completed planning material (phases H
hardening, P polish, F product, D deployment, FB feedback, the v5 audit docs)
was disposed 2026-09-04 after shipping — the detail lives in git history
(`TODO.md` before this rewrite, `docs/V5-IMPLEMENTATION.md`,
`docs/v5-review.md`) and in ROADMAP §7's phase notes.

## In flight

- none — all open lanes live in the sections below.

## Shipped since the 2026-09-04 rewrite

- **de/fr/uk translation drafts** — completed 2026-09-05, accepted **as-is**
  (no review pass): kick-started via `bun run kickstart:locale` (translat
  egemma:12b), ~40 pwa keys keep English fallback where the safety net rejected
  invented/renamed `{tokens}` and fragment keys. Locales are registered in
  `common/project.inlang/settings.json`, so they compile and auto-serve to
  matching browsers (`preferredLanguage` strategy); `APP_LOCALES` in the pwa
  now offers the full set (en/ro/de/fr/uk). Web still serves `baseLocale`
  English only — blocked on the URL-routing migration in the next section.

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
4. **Flip the languages live.** The de/fr/uk catalogs are **accepted as-is**
   (2026-09-05) — no review gate remains on the languages themselves; flipping
   them on web is purely this migration.
**Risks:** React-plugin order (`tanstackStart()` before `react()` on vite —
mirror the official example); server-fn exclusion; `PUBLIC_*` prefix (highest
blast radius — assert stats + PWA URL in a smoke); vite is new to this repo.

## Architecture hardening — shipped 2026-09-05

All eight items closed in one session: BFF contract types wired into pwa +
admin via `@remindit/bff/api` (type-only; `"./api"` → zod-only contracts, never
the server graph); `@remindit/common`/`@remindit/bff` declared in
web/admin/pwa; pwa/seed consumes `@remindit/common/seeds` with `FREQ_TO_DAYS`
hoisted to common (+ seed-parity test); root lint/check/format now run biome
repo-wide; lazy sync PB client (`getPb()` — no module-load side effects);
migrate engine extracted to testable `src/schema/reconcile.ts` (collection-name
constants driving builders + derived `SYNC_COLLECTIONS`); per-collection repos
(teams/members/notifications); unified client 401 policy (pwa signs out via a
`setUnauthorizedHandler` hook; cookie transport documented-reserved for web SSR
auth); low tier: `pwa/src/lib/env.ts`, web brand vars from
`@remindit/common/brand`, `useAdminResource`, `NOTIFICATION_TYPES` const,
response-validation policy. Ambient-decl sharing evaluated and NOT done (each
consumer needs its own `*.svg?raw` declaration). Commits: `3b9f56d`–`b715eb7`.

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
