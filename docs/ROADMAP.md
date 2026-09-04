# Remindit roadmap

Two layers, one file:

- **Product versions** (§1) — what the app does for its users, from the
  original `pwa`-only outline, updated to the workspace perspective (platform
  modules and shipped phases referenced inline).
- **Platform rollout** (§2+) — the bff / web / admin build-out: approved
  decisions, architecture, phases, gates. Kept as the decision log now that
  every phase has landed.

Active work and sequencing live in [TODO.md](../TODO.md) — update this file
when something ships, and TODO.md for what's in flight. Each platform phase
was one feature branch, merged only after its verification gate. See also
root [README.md](../README.md) for the module table.

Platform status: **all phases landed** (2026-09-02). Product status: V1–V4
shipped (pwa v4.4.0), V5 in progress, V6 not started.

---

## 1. Product roadmap

### [x] Version 1 — shipped

- [x] The user has `items` to be added to the shopping `list`. The items are organized into `categories`. Adding/removing items from the list is logged into `history`.
- [x] The user data is: `name`, `photo`. If no data is available, the user is prompted to provide it or accept default values, randomly generated.
- [x] The main screen shows the list of items, organized by category. Controls are available to add/remove items, and to edit items and categories.

### [x] Version 2 — shipped

- [x] Based on the user's shopping history, the app provides item recommendations.
- [x] The algorithm used for recommendations is either a time-series or a collaborative filtering algorithm. TBD.
- [x] Users will be able to add, edit, and remove items and categories.
- [x] Display ordering options will be available for categories, items, and the shopping list.

### [x] Version 3 — shipped as v3.1.0–v3.4.0

Core PWA + personalization slice (see `pwa/CHANGELOG.md`):

- [x] Categorical color palettes (pool in `seed/palettes.json`, picker in Profile, Van Gogh default) — distinct sequential slots, WCAG contrast, reactive `$categoryById`
- [x] Basic user profile + first-run onboarding (2-step: rollable `generate-random-username` + DiceBear avatar, dataset picker, `/onboarding` gate, `src/stores/onboarding.ts`)
- [x] Inspect history (`/history`, grouped by day, snapshot `categoryName`)
- [x] Quick search+add (`+` → grouped `Autocomplete`, recommendation-aware, create-under-Uncategorized)
- [x] Automate screenshots in PWA manifest (`scripts/generate-mobile-screenshot.ts`, light/dark gallery in `pwa/README.md`)
- [x] PWA checklist & hardening — installability (manifest + SW `fetch` + HTTPS + maskable icons), offline shell, `navigateFallback`, safe-area, standalone mode, update prompt (`src/components/update-prompt.tsx`), `pwa/docs/DEPLOY.md`
- [x] App updates in browser (SW update flow, `UpdatePrompt` wired in `src/router.tsx`)
- [x] Help content — text (`pwa/src/views/help.tsx`, `about.tsx`, `onboarding.tsx` copy; updated for floating sort + alphabetical A–Z in v3.4)
- [x] Internal hardening pre-V4 — hooks out of `src/stores` barrel, cross-store flows in `src/stores/commands.ts`, pure helpers in `src/lib/` (`quick-add`, `history-view`, `display`, `pwa-install`), palette seeding consolidation, history snapshot + palette reactivity fixes

### [x] Version 4 — shipped as v4.0.0–v4.4.0

- [x] [DESIGN.md](../pwa/DESIGN.md) — design system as shipped (contributors, text-only)
- [x] Onboarding welcome step — intro + add-items demo video (autoplay, muted, looped, no controls) with a `Steps` indicator rail (new `@shark/steps` primitive)
- [x] Share page (`/share`): export the current shopping list as a PNG image — light-theme branded card, unchecked items grouped by category, download + copy-to-clipboard (`@zumer/snapdom`)
- [x] Help content: guided tour (Help page embeds 5 demo videos with theme-matched variants)
- [x] Add license (AGPL-3 LICENSE.txt at repo root)
- [x] Multi-language support — English (default) + Romanian first (German, French, Ukrainian later); language selection as the first onboarding step, UI language switchable in Profile; Paraglide JS (shipped in v4.2.0)
- [x] Avatar picker (12 rerollable options) + backup export/import (v4.4.0)

### [x] Version 5 — shipped v5.0.0 (2026-09-03)

Sync + sharing + notifications, one major release.

- [x] Sync with the server — list saved and loaded across devices: local-first engine (`pwa/src/stores/sync/`), journal + three-way reconciliation + LWW, realtime SSE, offline behavior — see `pwa/docs/SYNC.md`
- [x] Multi-user support — shared lists with a group switcher on Profile, owner-gated invite by exact username, owner/member role badges, remove/leave flows (`SharedListCard` + `stores/sync/group-actions.ts`)
- [x] Family shopping-list flow on top of sharing — invites and roles surfaced in-app (owner / member)
- [x] In-app notifications for membership changes (realtime; Web Push deferred — D4 in the decision log)

### [ ] Version 6

- [x] App website — standalone marketing site (`web/`: hero + live stats + features + download pages); live at `https://www.remindit.me` (deployed with the platform, Phase D 2026-09-04). Live PWA: `https://remindit.me`
- [x] Community of early adopters and feedback capture — Apache Answer sidecar at `https://feedback.remindit.me`, submit API (member + guest), tag-seeded quick links, login-link flow, branding (phase FB); see `pwa/docs/LINKS.md#integrations`
- [ ] Basic AI features
- [ ] Integration with LLMs (MCP, skills)

### Wishlist

- [ ] Items might have attributes associated with them, such as photo, quantity, or price.
- [ ] Native application
- [ ] Notifications and live activities/updates

---

## 2. Approved decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Groups | **Shared workspaces** — a group owns categories, items and lists; users are members with roles (owner / member) | Enables shared shopping lists; drives the whole collection schema |
| D2 | Topology | **Everything via Hono** — PocketBase is never public (127.0.0.1); Hono is the only public surface. App-level concerns are a **typed Hono API** (Hono RPC + Zod); whether the PWA sync data-plane re-uses PB's record API via a scoped `/pb/*` forwarder or bespoke endpoints is **decided in phase 5** (hybrid recommended, see §9) | PB stays internal; one public surface, one auth guard; typed contract for frontends |
| D3 | Hosting | **Same VPS** as the PWA static bundle — PB binary + Hono process behind a reverse proxy, SQLite volume on disk | One server to operate; PB needs a persistent process + local SQLite |
| D4 | Notifications | **In-app realtime, decided 2026-09-03** — dispatch is BFF-side over the existing `notifications` collection (membership lifecycle events only: `member.added`/`member.left`/`member.removed`, best-effort, superuser-written); the pwa consumes via a user-scoped PB realtime subscription + connect-time fetch, surfaced in Profile. **Web Push deferred** (iOS delivers only to home-screen-installed PWAs; the Bun-compatible sender libs are immature — re-evaluate with retention data; a future sender would ride the same rows). **Email rejected** (deliverability/spam ops on a single VPS, unverified emails at open signup, wrong cadence for a shopping list) | Zero new infra; list activity stays notification-free until a batched design exists (per-item events are too noisy) |
| D5 | Stack | BFF = **PocketBase + Hono** on Bun (Hono over Elysia: Web-standard model + runtime portability, per [analysis](https://chatgpt.com/share/6a978f02-8e68-83eb-b3e2-0a5d4a602c63)); web/admin = **Rsbuild + TanStack Start** (official `@tanstack/react-start/plugin/rsbuild` adapter); admin UI = **Mantine** | Per user brief + TanStack blog (Jun 2026): Start supports Rsbuild 2 first-class |
| D6 | Tooling | `@fadlee/pocketbase-bin` (bunx-runnable PB binary manager, version-pinned via env); `gaspechak-pocketbase-mcp` as agent MCP server for schema/record ops | Per user brief |
| D7 | Schema source of truth | **`bff` consumes `@remindit/common`** to build and migrate PB collections | Domain types live in common; PB schema must never drift from them |
| D8 | BFF layering | `routes → services → repositories` inside the bff — routes never call the PB SDK directly; PB JS SDK is **server-side only** (`autoCancellation(false)`, `pb.filter()` for any untrusted filter input). Frontends consume the typed contract via Hono RPC (`hc<AppType>`) + Zod validation; `AppType` exported from a small `@remindit/bff/api` subpath and kept deliberately small | From the ChatGPT analysis: "PocketBase concerns stay in the service layer; application concerns stay in the BFF" — swap-ready infrastructure |
| D9 | Environment | **One `.env` + one committed `.env.example`, both at the repo root** — all modules consume from there; no per-module env files | Single place to configure; no drift between modules; secrets live in one gitignored file (prod secrets come from the VPS environment, never from the repo) |

## 3. Architecture

```
                        VPS (same host)
┌──────────────────────────────────────────────────────┐
│ reverse proxy (Caddy, auto-TLS *.remindit.me)         │
│   remindit.me     → pwa static (/var/www/remindit)   │
│   www.remindit.me → web SSR     (TanStack Start :3200)│
│   admin.remindit.me→ admin SSR  (:3300) + basicauth  │
│   api.remindit.me → Hono BFF  (Bun.serve, :3100)     │
│                    │  /api/* → typed Hono RPC       │
│                    │           (Zod, PB SDK         │
│                    │            server-side)        │
│                    │  /pb/*  → scoped data-plane    │
│                    │           forwarder → PB       │
│   feedback.remindit.me → Apache Answer (:5555) [FB, D5]│
│                                                    │
│   supervised by bm2 (infra/ecosystem.config.ts):     │
│   pb (:8090, internal only) + bff + web + admin     │
│     + feedback (Apache Answer sidecar)              │
│   backups: systemd timer → pb_data/backups (local)  │
│     + feedback/answer-data (strategy TBD)           │
└──────────────────────────────────────────────────────┘
```

- **Clients** (`web`, `admin`) talk to the **typed Hono API** (`/api/*`, Hono
  RPC + Zod — see D8); they never see PB's API shape. **`pwa`** additionally
  needs an efficient sync data-plane (bulk CRUD + realtime SSE across several
  collections): whether that is a scoped authenticated `/pb/*` forwarder
  (PB SDK client-side with `baseUrl = BFF_URL`) or bespoke BFF endpoints with
  server-side PB SDK + custom SSE is an explicit **phase 5 decision** (§9).
- **Hono customs** (`/api/*`): auth sessions, groups management, public stats
  for the marketing site (total users/groups), notification dispatch (later),
  health — all backed by the server-side PB SDK through the service layer.
- **Migrations** run from the repo against PB's admin API; PB itself is
  never a migration target by hand (no drift).

## 4. Workspace layout (target)

| Module | Path | Stack | Purpose |
|--------|------|-------|---------|
| `@remindit/common` | `common/` | TS source | Brand + domain entities (unchanged; gains sync-era types if needed) |
| `@remindit/pwa` | `pwa/` | Rsbuild + React + nanostores | Existing PWA; gains sync (phase 5) |
| `@remindit/bff` | `bff/` | Bun + Hono + PocketBase | Auth, groups, sync backend, stats, notifications |
| `@remindit/web` | `web/` | Rsbuild + TanStack Start | Marketing site; minimal BFF use (totals) |
| `@remindit/admin` | `admin/` | Rsbuild + TanStack Start + Mantine | Registration, admin dashboard, users + groups dashboards (last priority) |

### Domain model → PocketBase collections

Derived from `common/src/models/types.ts` + D1:

| PB collection | Type | Fields (→ common type) | Notes |
|---------------|------|------------------------|-------|
| `users` | auth | + `username`, `firstName`, `lastName`, `avatar` (text: data-URI SVG) | mirrors `UserProfile`; email is PB's auth identity |
| `groups` | base | `name`, `owner` → users | one group = one shared workspace |
| `group_members` | base | `group` → groups, `user` → users, `role` (`owner`\|`member`) | join collection; drives all API rules |
| `categories` | base | `group` → groups, `name`, `frequency` (→ `CATEGORY_FREQUENCIES`), `color` (number, optional) | `uncategorized` sentinel seeded per group |
| `items` | base | `group`, `name`, `category` → categories | `CatalogItem` |
| `list_entries` | base | `group`, `item` → items, `checked`, `addedAt` | `ListEntry` |
| `history_events` | base | `group`, `action` (`add`\|`remove`), `itemId`, `itemName`, `categoryId`, `categoryName`, `timestamp` | `HistoryEvent` (name/category snapshots kept) |
| `notifications` | base | reserved (D4) | channel decided later |

API rules: every data collection is scoped by `group_members` membership
(`@collection.group_members.group ?= group && @collection.group_members.user ?= auth.id` pattern);
only `users` create/`groups` create are public-ish. Final rules drafted in
phase 2 and validated with the MCP `pb_rules_test` tool.

## 5. Environment convention (D9)

**Single root `.env`** (local-only, gitignored) + **single committed root
`.env.example`**. No per-module env files. Verified mechanism (Bun 1.4): Bun
auto-loads `.env` only from the invocation cwd — it does **not** walk up to
parent dirs — but `bun --env-file=../.env` (relative to invocation cwd) injects
the root file, and the vars propagate through child processes even when they
`cd` or spawn CLIs. Therefore:

- **Root scripts are the env-bearing interface**: each delegation script
  launches the module process from the repo root with
  `bun --env-file=.env …` (e.g. `dev:bff` → `bun --env-file=.env bff/src/index.ts`,
  `dev:pwa` → `bun --env-file=.env …` invoking the rsbuild CLI with the
  module's config; rsbuild apps resolve module-relative paths via the config's
  `root` option and read build-time vars from `process.env`).
- Module-local scripts stay for env-less tasks (pure unit tests, typecheck);
  anything env-dependent is run through the root script. If a module-local env
  run is ever needed, prefix with `bun --env-file=../.env`.
- Prod: the VPS process manager supplies the same variable names; the root
  `.env` is never deployed or committed.

| Variable | Consumer | Example | Notes |
|----------|----------|---------|-------|
| `PORT` | bff | `3100` | Hono (Bun.serve) port |
| `POCKETBASE_URL` | bff | `http://127.0.0.1:8090` | internal, never public |
| `POCKETBASE_VERSION` | bff | `0.29.x` | pin via pocketbase-bin |
| `POCKETBASE_DATA_DIR` | bff | `bff/pb_data` | gitignored |
| `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` | bff (dev, migrations, MCP) | dev creds | superuser; **dev-only**, prod via VPS secrets |
| `PUBLIC_BFF_URL` | pwa / web / admin | `http://localhost:3100` | client `baseUrl` for PB SDK + `/api` |

## 6. Dev experience

All scripts runnable from repo root (existing delegation pattern). Each
module owns `dev`, `build`, `test`, `typecheck`, `lint`; the root gains
per-module and combined variants so any subset can be worked on:

```sh
bun run dev:pwa       # pwa only (current `dev`)
bun run dev:bff       # PB (pocketbase-bin) + Hono, ordered startup
bun run dev:web       # web only
bun run dev:admin     # admin only (phase 6)
bun run dev           # pwa + bff (+ web/admin once they exist)
bun run typecheck     # all existing modules (delegates per module)
```

Root `typecheck` extends to each new module as it lands; Biome already
covers the whole repo (verify `biome.json` includes new dirs per phase).

Env always comes from the root `.env` (D9): the root scripts are the entry
point for any env-dependent run (`dev:*`, migrations, MCP creds).

## 7. Phases — one feature branch each

### Phase 0 — workspace foundations · `feat/platform-foundations` ✅
- [x] `docs/ROADMAP.md` (this file) + README/AGENTS pointers
- [x] Root scripts: `dev` is an alias of `dev:pwa`; env-bearing delegations use `cd <module> && bun --env-file=../.env run <script>` (D9; verified — vars propagate, missing `.env` tolerated). `dev:bff|web|admin|all` land with their modules (nothing to point at yet); `typecheck` composition exists and gains modules as they land
- [x] Root `.env.example` committed with all planned + existing vars (§5); the **tracked** `pwa/.env.example` was merged into it and removed; local `pwa/.env` migrated to root `.env` (no `.gitignore` change needed — the existing `.env` pattern already ignores it everywhere). Verified end-to-end: Rsbuild inlines `PUBLIC_*` from process.env (marker-value build test)
- [x] Biome/tsconfig conventions documented (AGENTS.md §Platform conventions)
- Gate: `bun install && bun run typecheck && bun run lint` green; pwa behavior unchanged (`PUBLIC_DATASET`/`PUBLIC_SEED_HISTORY` still inlined)

### Phase 1 — bff skeleton · `feat/bff-skeleton` ✅
- [x] `bff/` module: package.json, tsconfig, AGENTS.md, README.md (devdoc); env from the root `.env` (D9) — no module env file
- [x] Hono app on Bun.serve with **routes → services → repositories layering** (D8): `/api/health` (BFF liveness + PB reachability, PB-down is a reported state); server-side PB client module (`autoCancellation(false)`)
- [x] `@remindit/bff/api` subpath exporting `AppType` + Zod contracts (`src/contracts.ts`); `@hono/zod-validator` lands in phase 3 with real inputs
- [x] **Spike: streaming through Hono on Bun** — SSE verified unbuffered (unit test with chunk-count assertion + live curl); `idleTimeout: 255` set for future realtime
- [x] dev script: PB via `bunx @fadlee/pocketbase-bin serve` (`POCKETBASE_VERSION=0.40.1` pinned; binary + `pb_data/` gitignored), health-wait (120s deadline for first-run download), reuse of an already-running PB, then Hono on `PORT`
- [x] pocketbase-mcp added to `opencode.jsonc` (disabled by default; wrapper `bff/scripts/pocketbase-mcp.ts` injects superuser creds from the root `.env`)
- [x] Tests (bun test): health contract round-trip, `hc<AppType>` RPC over live HTTP, SSE buffering detector — 3 pass
- Gate: typecheck (pwa + common + bff) + lint + tests + live smoke (`/api/health` → `pb:"up"` via real PB, SSE streaming) ✅
- Note: root `dev:all` runs pwa + bff via `concurrently` (root devDep, per §6)

### Phase 2 — schema & migrations · `feat/bff-schema` ✅
- [x] `bff/src/schema/`: PB collections JSON builders importing `@remindit/common` (frequencies, sentinels, types) — 8 collections: users, groups, group_members, categories, items, list_entries, history_events, notifications (reserved, D4)
- [x] `bff/scripts/migrate.ts`: superuser auth from env (auto-provisions via `pocketbase-bin superuser upsert` on first run) → **pass A** create structure without rules (PB validates `@collection.*` rule references at definition time — all collections must exist first) → **pass B** canonicalized per-collection diff → patch. Never deletes; idempotency verified live (second run ⇒ all `unchanged`)
- [x] API rules per §4 table — **live-verified rule matrix (8/8)** incl. the two uncertain patterns: create rules are evaluated against the hydrated record, and `@request.body.<relation>` resolves for membership scoping (PB 0.40.1). Details + matrix: `bff/docs/SCHEMA.md`
- [x] Devdoc `bff/docs/SCHEMA.md` (mapping table, rules, migration algorithm, sentinel strategy — sentinel provisioning lands with the phase-3 groups service)
- [x] Builder integrity tests (`tests/schema.test.ts`: unique names, relation ordering, `CATEGORY_FREQUENCIES`/`HistoryAction` mirroring) + root `migrate:bff` script
- Gate: migrate on live PB → reconcile 15 changes → re-run ⇒ `✓ schema in sync (8 collections, no changes)`; rules matrix 8/8 ✅; typecheck + lint + 8 bun tests green

### Phase 3 — auth & groups API · `feat/bff-auth-groups` ✅
- [x] `/api/auth/*` (register, login, logout, me) — PB auth pass-through with **dual transport**: Bearer token (pwa) + HttpOnly SameSite=Lax session cookie (web, `SESSION_COOKIE_SECURE` env for prod); every authenticated request validates **and rotates** the token via PB auth-refresh
- [x] `/api/groups/*` CRUD + member management — creator becomes owner-member automatically; **all authorization via PB rules on the token-scoped client** (BFF never widens access, D8); Hono RPC + `@hono/zod-validator` for request bodies, Zod response contracts
- [x] Notification stubs: `GET /api/notifications` + `PATCH :id` (list + mark-read; channel undecided, D4)
- [x] Devdoc `bff/docs/API.md` (endpoints, auth flows, error shape, live gate results)
- [x] Tests: unit (401 boundaries, contract rejects, cookie clear) + **live integration suite (10/10 vs PB 0.40.1)** — every response parsed against the published Zod contract; integration tests skip (not fail) when PB is down
- Gate: typecheck ×3 modules + lint + 25 bun tests green ✅
- Gotchas recorded: hc per-request headers go in the second `options` arg (hono 4.13); SDK attaches Authorization only when `authStore.isValid`; PB `expand` rides the query string (ignored in create body); failed CREATE rules surface as 400, not 403; `created/updated` autodate fields added to all data collections (phase-5 sync needs them)

### Phase 4 — web marketing site · `feat/web-marketing` ✅
- [x] `web/`: Rsbuild + `@tanstack/react-start` (`./plugin/rsbuild` adapter — `pluginReact()` chained **after** `tanstackStart()`), SSR with server functions; brand from `@remindit/common/brand` (logo as SVG data-URI `<img>` — no asset pipeline)
- [x] Pages: `/` (hero + **live stats** + install CTA), `/features` (6 feature cards), `/download` (PWA install steps, `PUBLIC_PWA_URL`); per-route `head()` SEO meta + Open Graph; favicon as inline SVG data URI
- [x] Minimal BFF use: `GET /api/stats` on the bff (public aggregate counts, superuser-side counting, 60s cache, `cache-control: public, max-age=60`); web server function degrades to `null` counts when the BFF is down — marketing never 500s
- [x] Devdoc `web/README.md` + `web/AGENTS.md`; root scripts (`dev:web`, `build:web`, `dev:all` = pwa + bff + web concurrently); env `WEB_PORT` (3200), `PUBLIC_PWA_URL`
- [x] Generated `src/routeTree.gen.ts` committed (typecheck needs it); biome excludes it (generator emits `as any`)
- Gate: typecheck ×4 modules + lint + build ✅ + **live smoke via `dev:all`**: BFF `{"users":70,"groups":3}` rendered in SSR home (`<strong>70</strong>`), features/download 200, pwa unaffected (3000) ✅
- Note: web dev server binds IPv6 `[::1]` (rsbuild default) — use `localhost`, not `127.0.0.1`; deployment of the SSR bundle lands with the platform deployment phase

### Phase 5 — pwa sync · `feat/pwa-sync` ✅
- [x] Design doc first: `pwa/docs/SYNC.md` — identity model (local ids stay; pb records carry `localId` + per-group unique indexes; per-device sync map), **journal + three-way reconciliation** (LWW by PB server-side `updated`), realtime via subscriptions, offline behavior, security notes, deferred scope
- [x] **Data-plane decision (D2/§9): hybrid** — typed BFF RPC for account ops + scoped authenticated `/pb/*` forwarder (PB SDK client-side, `baseUrl = PUBLIC_BFF_URL + "/pb"`) for record CRUD + realtime; PB rules remain the authorization boundary
- [x] BFF: `/pb/api/*` forwarder (auth-gated, rotated token forwarded, hop-by-hop stripped, SSE unbuffered) + integration tests (auth gating, rule-scoped CRUD, unique-index dedupe, SSE passthrough)
- [x] Schema delta: `localId` + unique `(group, localId)` indexes on categories/items/list_entries/history_events
- [x] pwa sync engine (`src/stores/sync/`): session store, BFF fetch client (types mirrored from the BFF contracts), pure reconcile diff (`reconcile.ts`, unit-tested — journal/three-way/LWW/tombstones/adoption), engine (group bootstrap + sentinel provisioning, reconcile apply, realtime subscriptions, tombstone detection via store snapshots, profile LWW sync)
- [x] Auth UI: Sync card in Profile (sign in/up/out + status, en+ro i18n); notifications consumer in-app only (D4 channel decision still open — dispatch lands with the channel)
- Gate: pwa `test:pre` fully green (**272 Rstest** incl. 13 new reconcile tests + 23 dev e2e + 2 prod e2e), bff suite 36 tests, typecheck ×4, lint ✅; **live two-device check**: device A creates a category through the forwarder → member device B sees + patches it → realtime SSE streams ✅
- Manual two-device scenario (browser tabs, two profiles): documented in SYNC.md §Testing

### Phase 6 — admin · `feat/admin` ✅
- [x] `admin/`: Rsbuild + TanStack Start + Mantine; login + create-user registration modal (users dashboard), dashboards (overview, users, groups); **client-side auth gating** — Bearer token in `localStorage`, guards are mount effects (`src/lib/auth.ts`), data fetching client-only (`useEffect`)
- [x] Role model: `users.role` (`user`\|`admin`) + BFF `/api/admin/*` guards (session role checked server-side, 403 before any superuser query); first admin bootstrapped by `migrate` (promotes the `POCKETBASE_ADMIN_EMAIL` user); **BFF CORS allowlist** (`CORS_ORIGINS` via `hono/cors` — frontends live on separate origins, needed by admin today and any browser client in prod)
- [x] Devdoc `admin/README.md` (+ `admin/AGENTS.md`); root README module table completed
- Gate: typecheck ×5 modules + lint + build ✅ + **live e2e smoke** (`dev:bff` + `dev:admin`): login → overview renders live counts (122 users / 9 groups), users + groups dashboards live, create-user → 201 + listed, non-admin sign-in client-rejected + `/api/admin/*` 403, sign-out/in clean ✅; bff suite 37 tests green
- Gotchas recorded: TanStack Start runs `beforeLoad` server-side during SSR where the localStorage token is invisible — a guard there bounces every hard navigation to `/login` and the hydrated router trusts that resolution (stuck); auth guards must be client-side mount effects, and post-login navigation must be `router.navigate` (a full reload re-enters the SSR token-less redirect dance)

## 8. Verification gates (every phase)

1. `bun run typecheck` (root, covering all landed modules)
2. `bun run lint` / `bun run check` (Biome, whole repo)
3. Module test suites (see phase lists)
4. Devdoc present/updated (module README + this file's checkboxes)
5. No secrets committed; root `.env.example` updated when a variable is added (D9)

## 9. Risks & open questions

- **Sync data-plane decision (phase 5)** — the [ChatGPT analysis](https://chatgpt.com/share/6a978f02-8e68-83eb-b3e2-0a5d4a602c63) says "don't expose the PB SDK to clients", but it predates the offline-first sync requirement; re-implementing PB's record CRUD + SSE realtime as bespoke endpoints is substantial work. Hybrid (typed RPC for app concerns + scoped `/pb/*` forwarder for the sync engine) is the working recommendation; revisit with real sync numbers.
- **Hono RPC type instantiation** — keep the exported `AppType` small (chain only what clients need), pin `hono` versions across bff/clients (workspace catalog), and watch TS project-reference setup, per Hono's own monorepo caveats.
- **PB schema import is wholesale-replace** — migrations must fetch → diff →
  merge; never blind-import. Idempotency test required (phase 2).
- **`UserProfile.avatar` is an inline data-URI SVG** — fine as a PB text field
  initially; revisit as PB file storage if size becomes an issue.
- **TanStack Start + Rsbuild is new** (Jun 2026) — pin versions; verify SSR +
  static prerender behavior for the marketing site early in phase 4.
- **web/admin design language** — `pwa/DESIGN.md` is PWA-scoped; marketing
  should follow brand constants from `common`, with its own lighter design
  notes.
- Deployment automation (bff on the VPS: process manager, backups of
  `pb_data/`) — decide during phase 3/4; PB has built-in backup endpoints
  (MCP `pb_backup`).
