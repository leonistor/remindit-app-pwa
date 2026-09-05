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

## Next session: web locale routing — Rsbuild-native (no Vite move)

**Goal:** give `web/` real per-locale URLs (`/ro`, `/de`, `/fr`, `/uk`) so the
translated catalog can actually be *served* (today it only compiles into the
bundles).

**Updated premise (2026-09-05 research) — NO framework swap needed.** The
earlier note claimed the **Rsbuild** adapter had no `src/server.ts` seam and
forced a Vite move. Verified against the installed
`@tanstack/react-start@1.168.49` (start-plugin-core source) that **Rsbuild
supports the same server-entry seam as Vite**: `resolveStartEntryPlan()`
resolves a user `src/server.ts` (`resolveEntry({ configuredEntry:
startConfig.server.entry, defaultEntry: 'server', required: false })`) and the
rsbuild `server.setup` middleware (`createServerSetup`) dispatches ALL SSR
traffic — server functions + page navigations — to that bundle's `default`
fetch handler in dev, preview, and prerender. So `export default
createStartHandler({ handler: defaultStreamHandler })` is first-class on
Rsbuild. The "Portable application model" is the TanStack design: *keep the
routes, change the output* — one authoring surface for Vite and Rsbuild.

**Verified facts** (confirmed against installed node_modules, 2026-09-05):
- `createStartHandler` / `defaultStreamHandler` / `StartServer` ship via
  `@tanstack/react-start/server` (re-exports `react-start-server`), and
  `createStartHandler({ handler })` returns the exact `{ default: fetch }`
  shape the rsbuild `server-middleware.js` + `post-build.js` consume.
- The compiler is triggered by the rspack plugin + `scripts/compile-i18n.ts` —
  no `paraglideVitePlugin` even exists in the dependency this adapter path uses.
- `web/src/paraglide/server.js` is already emitted (a no-op under
  `["baseLocale"]`); switching the strategy to include `"url"` turns it into
  the real `paraglideMiddleware`.
- `rsbuild`'s preview SSR reads the same server bundle → **deploy launcher
  `infra/bin/start-web.sh` (`bun run preview`) and the bm2 ecosystem stay
  unchanged**.
- rsbuild inlines `PUBLIC_*` natively — the Vite `envPrefix` gotcha does NOT
  apply (nothing to configure).

**Staged plan** (each stage gated: `typecheck` + lint + `build:web` + live
smoke of the 4 routes for SSR/hydration + a prerender check):
1. **Add the server entry, zero auth/stat behavior change.** New
   `web/src/server.ts`: `createStartHandler(defaultStreamHandler)`; keep
   `strategy: ["baseLocale"]`. This exercises the seam in isolation — output
   must be byte-identical to today (dev, preview, `/_serverFn/*`).
2. **Enable locale routing.** `strategy: ["url", "baseLocale"]` +
   `urlPatterns` (en unprefixed at `/`, then `/ro`, `/de`, `/fr`, `/uk`;
   model on the `IgorSzymanski/tanstack-start-paraglide` template), run
   `paraglideMiddleware` at the top of the server entry (it strips the prefix,
   sets the locale + cookie, drives the router `rewrite`), and localize links
   (`localizeUrl`/`localizeHref` wrapper around TanStack `Link`, or the
   strategy's built-in URL handling on `setLocale`). Exclude `/_serverFn/*`
   from the URL strategy so typed server calls aren't parsed as a locale.
3. **Ship.** Rebuild + `bm2 reload web`; verify prod URLs + canonical/hreflang.
4. **Flip the languages live.** The de/fr/uk catalogs are **accepted as-is**
   (2026-09-05) — no review gate remains on the languages themselves; flipping
   them on web is purely this change.
**Risks:** `paraglideMiddleware`'s exact request→`{ request, locale, response }`
round-trip must be adapted to `createStartHandler`'s `RequestHandler` signature
(confirm the reference template's wiring on the server entry, not `ssr.tsx`);
`routeStrategies` to keep `/_serverFn/*` + static assets out of the locale
parser; hydration must agree between the stripped server URL and the
client-preferred locale on first paint.

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
