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

## Deferred (by decision — revisit when triggered)

- **Notifications hardening** — when Web Push or digests arrive: typed `type`
  enum + discriminated payload in contracts, `dedupeKey` + `(user, created)`
  indexes via the idempotent migrate, paginated list (today: plain-text types,
  untyped payload, unpaginated `getFullList`).
- **Feedback follow-ups** — real SMTP provider (Inbucket is dev-grade; swap
  via `configure:feedback smtp`), logo upload in the Answer admin (API cap),
  delete the deployment smoke-test question.
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
