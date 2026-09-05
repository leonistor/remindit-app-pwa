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

- [x] App website — standalone marketing site (`web/`: hero + live stats + features + download + screenshots pages); live at `https://www.remindit.me` (deployed with the platform, Phase D 2026-09-04; localized URL routing + pre-MVP content pass in v5.3.0). Live PWA: `https://remindit.me`
- [x] Community of early adopters and feedback capture — Apache Answer sidecar (`https://feedback.remindit.me`, submit API, tag-seeded quick links, login-link flow, phase FB); **removed 2026-09-05** after live use (D13) — the Q&A board added more friction than value, no in-app substitute
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
| D10 | Deployment | **bm2 (Bun-native PM2, pinned 1.1.0) + Caddy** on the single VPS (D3) — one ecosystem file (`infra/ecosystem.config.ts`: pb, bff, web, admin; all loopback, health-checked, log-rotated), Caddy as the only public surface (`remindit.me` = pwa static, `www` = web, `admin` = admin behind `basic_auth`, `api` = bff; PB `:8090` never proxied). Deploy = `git push vps main` (worktree repo at `/srv/remindit`); one-time privileged setup = `infra/bin/bootstrap-prod.sh` | All-Bun supervision with health checks, log rotation, zero-downtime reload, reboot persistence; admin origin gated at the proxy (decided 2026-09-04, phase D) |
| D11 | Backups | **Hourly local snapshots** via `remindit-backup.timer`: PB via its superuser backup API (`PB_BACKUP_KEEP`). **Off-box copy to Scaleway S3 via rclone** (wired 2026-09-04, same day): env-based remote from `SCW_*` in the root `.env` (no rclone.conf), bucket `remindit-backups` in `nl-ams` (lowest TLS latency from the VPS), `rclone copy` per run + independent 30-day off-box retention (`--min-age`) so a local wipe can't take the copies down | Consistent-while-running snapshots without downtime; off-box copy survives local disasters (decided 2026-09-04, phase D) |
| D12 | i18n source of truth | **Shared Paraglide catalog in `@remindit/common`** — `common/project.inlang` + `common/messages/*.json` are the single source of UI strings. `pwa` (`strategy: ["localStorage","preferredLanguage","baseLocale"]`, language pickers) and `web` (`strategy: ["url","baseLocale"]`, URL-prefixed per-locale, SSR-safe via `paraglideMiddleware` + request-scoped AsyncLocalStorage — shipped 2026-09-05) each **compile** the shared catalog into their own gitignored `src/paraglide` — the catalog is never imported directly. `kickstart:locale` (Ollama) drives the draft locales de/fr/uk; the drift guard enforces en↔ro key parity + placeholder/variant parity for **every** locale (an invented `{token}` in any locale widens the compiled input types for all consumers). Web serves all five locales: en un-prefixed at `/`, ro/de/fr/uk prefixed; new marketing keys ship in en+ro, with de/fr/uk falling back to English until their review pass | One catalog and one translation workflow for every module; web leaves hardcoded English; per-consumer compile preserves Paraglide tree-shaking/types with **no build step in common** (source-only) (decided 2026-09-05) |
| D13 | Feedback removal | **Apache Answer sidecar + all feedback surfaces removed** (feedback/ module, BFF /api/feedback + answer bridge + users.feedback_username, web /feedback route + footer/help links, pwa FeedbackCard) after live use showed the Q&A board added more friction than value for this user base. No in-app substitute. Kept the historical phase records (phase FB, D10/D11 as originally shipped) for the timeline; current-state topology/environment docs reflect the removal. | Smaller platform surface, fewer moving parts at runtime (decided 2026-09-05) |

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
│                                                    │
│   supervised by bm2 (infra/ecosystem.config.ts):     │
│   pb (:8090, internal only) + bff + web + admin     │
│   backups: systemd timer → pb_data/backups (local)  │
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

Derived from `common/src/models/types.ts` + D1 (note: collections are named
`teams`/`team_members` — `groups`/`group` collide with SQL reserved keywords;
see `bff/docs/SCHEMA.md` §Rename):

| PB collection | Type | Fields (→ common type) | Notes |
|---------------|------|------------------------|-------|
| `users` | auth | `username`, `firstName`, `lastName`, `avatar` (text: data-URI SVG), `role` (`user`\|`admin`) | mirrors `UserProfile`; email is PB's auth identity; first admin promoted by `migrate` |
| `teams` | base | `name`, `owner` → users | one team = one shared workspace |
| `team_members` | base | `team` → teams, `user` → users, `role` (`owner`\|`member`) | join collection; drives all API rules |
| `categories` | base | `team`, `localId`, `name`, `frequency` (→ `CATEGORY_FREQUENCIES`), `color` (number, optional) | `uncategorized` sentinel provisioned per team |
| `items` | base | `team`, `localId`, `name`, `category` → categories | `CatalogItem` |
| `list_entries` | base | `team`, `localId`, `item` → items, `checked`, `addedAt` | `ListEntry` |
| `history_events` | base | `team`, `localId`, `action` (`add`\|`remove`), `itemId`, `itemName`, `categoryId`, `categoryName`, `timestamp` | `HistoryEvent` (name/category snapshots kept) |
| `notifications` | base | `type`, `payload` (json), `read`, `user` → users, `team` → teams (optional) | in-app realtime channel (D4) |

`localId` + unique `(team, localId)` indexes (categories/items/list_entries/
history_events) are the phase-5 sync dedupe keys. API rules: every data
collection is scoped by `team_members` membership
(`@collection.team_members.team ?= team && @collection.team_members.user ?= auth.id` pattern);
only `users` create/`teams` create are public-ish. Final rules drafted in
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
| `POCKETBASE_VERSION` | bff | `0.40.1` | recorded pin — mirrored in `bff/.pocketbase-version` (no code reads the var) |
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

## 7. Phases — shipped (one feature branch each)

Every phase merged only after its verification gate (`bun run typecheck` root
+ `bun run lint` + module suites + devdoc + live smoke); per-phase gate
narratives live in git history. Decisions + env format: §2 and §4–6.

- **Phase 0 — workspace foundations** (`feat/platform-foundations`): Bun
  workspace, root env delegation (D9), committed root `.env.example`. `dev` is
  an alias of `dev:pwa`; `dev:all` runs modules via `concurrently` (root devDep).
- **Phase 1 — bff skeleton** (`feat/bff-skeleton`): Hono on Bun.serve,
  routes → services → repositories (D8), `@remindit/bff/api` subpath, SSE spike
  (`/api/sse`), PB via `pocketbase-bin`.
- **Phase 2 — schema & migrations** (`feat/bff-schema`): 8 base/auth
  collections + rules in `src/schema/collections.ts`, idempotent `migrate`
  (structure pass, then canonicalized diff/patch — never deletes), live rule
  matrix 8/8 (`bff/docs/SCHEMA.md`).
- **Phase 3 — auth & groups API** (`feat/bff-auth-groups`): `/api/auth/*`
  (dual transport: Bearer + HttpOnly cookie), `/api/groups/*`, notification
  stubs → D4; live integration suite 13/13 (`bff/docs/API.md`).
- **Phase 4 — web marketing site** (`feat/web-marketing`): Rsbuild + TanStack
  Start SSR, brand from `@remindit/common/brand`, minimal BFF use
  (`GET /api/stats`, degrades to `null` counts when the BFF is down).
- **Phase 5 — pwa sync** (`feat/pwa-sync`): design in `pwa/docs/SYNC.md`;
  **hybrid data-plane** = typed RPC for account ops + scoped `/pb/*` forwarder
  for record CRUD/realtime; journal + three-way/LWW engine in
  `src/stores/sync/`; `localId` + unique `(team, localId)` indexes. Gate:
  full `test:pre` + live two-device sync check.
- **Phase 6 — admin** (`feat/admin`): Rsbuild + TanStack Start + Mantine;
  `users.role` model + `/api/admin/*` guards (403 before any superuser query);
  first admin promoted by `migrate`; BFF CORS allowlist (`CORS_ORIGINS`).
- **Phase 7 — platform deployment + feedback**, deployed 2026-09-04: bm2 +
  Caddy + hourly local backups + off-box S3 copy (D10/D11); runbook
  `docs/DEPLOY-VPS.md`; feedback sidecar deployed with the phase, then
  **removed 2026-09-05 (D13)**.
- **Cross-cutting — shared i18n catalog** (`feat/shared-i18n-catalog`):
  catalog relocated to `common/`; pwa + web compile it via Paraglide; drift
  guard covers all locales (en↔ro strict, de/fr/uk ⊆ en). **Web locale
  routing delivered 2026-09-05 on `mvp-web`** — the Rsbuild adapter supports
  `src/server.ts` (verified in start-plugin-core source), so
  `paraglideMiddleware` wraps the request handler with a request-scoped
  `AsyncLocalStorage` (`strategy: ["url","baseLocale"]`, en unprefixed).

> **Gotchas (tribal knowledge — don't rediscover them):**
>
> - hc per-request headers go in the second `options` arg (hono 4.13); the PB
>   SDK attaches `Authorization` only when `authStore.isValid`; `expand` rides
>   the query string (ignored in create bodies); failed CREATE **rules** surface
>   as 400, not 403; `created`/`updated` autodate fields are on every data
>   collection (phase-5 sync needs them).
> - Create rules are evaluated against the **hydrated record** — `team.owner =
>   …` works and `@request.body.<relationField>` resolves for membership checks;
>   don't traverse further into `@request.body` relations (body values are ids).
> - TanStack Start runs `beforeLoad` **server-side** during SSR, where the
>   localStorage token is invisible — a guard there bounces every hard
>   navigation to `/login` (stuck). Auth guards must be client-side mount
>   effects; post-login navigation must be `router.navigate` (a full reload
>   re-enters the SSR token-less redirect dance).
> - web dev binds IPv6 `[::1]` (rsbuild default) — use `localhost`, not
>   `127.0.0.1`.
> - bm2 resolves ecosystem `script:` paths against the config dir (use absolute
>   launchers); systemd/sudo strip `~/.bun/bin` from PATH ("bun: not found");
>   fresh-install schema reconcile must land existing-collection field drift
>   BEFORE creating views (view queries are validated by execution); dotenv
>   files are unsafe to `sh`-source — wrappers load env via `bun --env-file`.

## 8. Verification gates (every phase)

1. `bun run typecheck` (root, covering all landed modules)
2. `bun run lint` / `bun run check` (Biome, whole repo)
3. Module test suites (see phase lists)
4. Devdoc present/updated (module README + this file's checkboxes)
5. No secrets committed; root `.env.example` updated when a variable is added (D9)

## 9. Risks & open questions

- **Sync data-plane (RESOLVED, phase 5)** — the [ChatGPT analysis](https://chatgpt.com/share/6a978f02-8e68-83eb-b3e2-0a5d4a602c63) said "don't expose the PB SDK to clients" but predates offline-first sync; the hybrid shipped: typed RPC for app concerns + scoped `/pb/*` forwarder for the sync engine (D2).
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
- **Deployment automation (RESOLVED, phase D)** — bm2 + Caddy + hourly local backups on the VPS (D10/D11), off-box S3 copy wired 2026-09-04 (see `docs/DEPLOY-VPS.md` §Backups).
