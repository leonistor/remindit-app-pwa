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
  now offers the full set (en/ro/de/fr/uk). The **web serves all five
  locales** via URL routing (de/fr/uk marketing keys fall back to English
  until their review pass — see the locale-routing note below).

## Next (V6 + wishlist, roadmap §1)

- [ ] Basic AI features
- [ ] LLM/MCP integration
- [ ] Item attributes (photo / quantity / price)
- [ ] Native app

## Shipped: web locale routing — Rsbuild-native (2026-09-05, branch `mvp-web`)

Delivered the URL-based per-locale routing on the **Rsbuild** adapter (no Vite
move). `web/src/server.ts` wraps the injected-default `createStartHandler`
in `paraglideMiddleware` (its AsyncLocalStorage drives SSR `getLocale`);
`strategy: ["url", "baseLocale"]` (en unprefixed, /ro//de//fr//uk
prefixed — Paraglide's **default** url pattern; the earlier custom
`urlPatterns` catch-all matched `/de` as en, so they were dropped); routes
moved under the optional `{-$locale}` segment so Links keep the prefix
client-side. Follow-ups **shipped** the same day: an in-page language
switcher (`setLocale`), per-page `canonical` + `hreflang` (incl. `x-default`)
via `web/src/lib/canonical.ts`, and a 301 `/en/*` → `/` rewrite in
`src/server.ts`. Verified: SSR in all five locales (dev + `bun run preview`),
client nav keeps the prefix, switcher navigates locale-to-locale, no hydration
or console errors. (Planning material — premise research, staged plan, the
`IgorSzymanski/tanstack-start-paraglide` reference — lives in git history +
`docs/ROADMAP.md` §7.)

## Shipped: web MVP content pass (2026-09-05, branch `mvp-web`)

Home now shows a subtitle platform-stats line, the README phone-screenshot pair,
and coming-soon/open-source blurb; `/features` is a marketing walkthrough with
three committed demo videos; new `/screenshots` page grids all eight committed
shots. Marketing media lives in committed `web/public/` (the pwa's mp4s are
generated+gitignored — README §Marketing media). New `web*` keys in
`common/messages/{en,ro}.json` the same day (de/fr/uk fall back to English);
old `webFeatureOffline/Privacy` keys removed from all locales.

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
