# Remindit platform architecture

Platform build-out (`bff` / `web` / `admin` on top of the `pwa`) and the
operating conventions that keep the monorepo coherent. The product roadmap
lives in [ROADMAP.md](ROADMAP.md), the decision log in
[DECISIONS.md](DECISIONS.md), the ops runbook in [DEPLOY-VPS.md](DEPLOY-VPS.md).

## Runtime topology

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
  RPC + Zod — see D8 in [DECISIONS.md](DECISIONS.md)); they never see PB's API
  shape. **`pwa`** additionally needs an efficient sync data-plane (bulk CRUD
  + realtime SSE across several collections) — **resolved in phase 5** as the
  hybrid: scoped authenticated `/pb/*` forwarder (PB SDK client-side with
  `baseUrl = BFF_URL`) for record CRUD/realtime, typed RPC for account ops —
  see [pwa/docs/SYNC.md](../pwa/docs/SYNC.md).
- **Hono customs** (`/api/*`): auth sessions, groups management, public stats
  for the marketing site (total users/groups), notification dispatch (D4),
  health — all backed by the server-side PB SDK through the service layer.
- **Migrations** run from the repo against PB's admin API; PB itself is
  never a migration target by hand (no drift).
- The ops layer (Caddy site blocks, bm2 supervision, backup timer, admin
  basicauth, exposure guardrails) is owned by [DEPLOY-VPS.md](DEPLOY-VPS.md).

## Health endpoints

Every server module exposes a **`GET /health`** (the bff at `/api/health`),
built on the shared [@remindit/common/health](../common/src/health) helpers:

| Module | URL | Scope |
|---|------|-------|
| bff | `/api/health` | prod + dev (Hono route) |
| web | `/health` | prod + dev (TanStack fetch-handler short-circuit) |
| admin | `/health` | prod + dev (TanStack fetch-handler short-circuit) |
| pwa | `/health` | **dev/preview only** — production serves a static bundle by Caddy (no process to probe; the pwa in prod is covered by the Caddy-mediated origin check) |

Contract (see `common/src/health/types.ts`):

```json
{ "ok": true, "service": "remindit-bff", "ts": "<iso>", "uptime": 12,
  "version": "0.1.0", "checks": { "pb": "up" } }
```

Semantics: **always HTTP 200 while the process is alive**; dependency health
(`ok` + `checks.*`) is carried in the body. bm2 probes reachability only, so a
down dependency (e.g. PB) must **not** read as a dead process and force a
restart — monitoring tools alert on the body instead. The bff's PB probe lives
in `bff/src/services/health.ts`; future modules add dependencies as extra
checks (probe failures fold to `"down"` and never throw).

## Workspace layout

The module table (module → path → stack → purpose) is owned by the root
[README.md](../README.md) — edit it there, not here.

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

## Environment convention (D9)

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

The **authoritative variable list** is the committed root `.env.example`
(the per-module READMEs list which vars each module consumes); adding or
renaming a var updates `.env.example` in the same commit.

## Dev experience

All scripts runnable from repo root (existing delegation pattern). Command
tables are owned by the per-module [AGENTS.md](../AGENTS.md) §Module
instructions and the module READMEs. Env always comes from the root `.env`
(D9): the root scripts are the entry point for any env-dependent run
(`dev:*`, migrations, MCP creds).

## Rollout history (one feature branch per phase)

Every phase merged only after its verification gate; per-phase gate narratives
live in git history. Branch names kept as pointers.

- **Phase 0 — workspace foundations** (`feat/platform-foundations`): Bun
  workspace, root env delegation (D9), committed root `.env.example`.
- **Phase 1 — bff skeleton** (`feat/bff-skeleton`): Hono on Bun.serve,
  routes → services → repositories (D8), `@remindit/bff/api` subpath, SSE
  spike, PB via `pocketbase-bin`.
- **Phase 2 — schema & migrations** (`feat/bff-schema`): 8 base/auth
  collections + rules in `src/schema/collections.ts`, idempotent `migrate`,
  live rule matrix 8/8 (`bff/docs/SCHEMA.md`).
- **Phase 3 — auth & groups API** (`feat/bff-auth-groups`): `/api/auth/*`,
  `/api/groups/*`, notification stubs → D4; live integration suite 13/13.
- **Phase 4 — web marketing site** (`feat/web-marketing`): Rsbuild + TanStack
  Start SSR, brand from `@remindit/common/brand`, minimal BFF use
  (`GET /api/stats`).
- **Phase 5 — pwa sync** (`feat/pwa-sync`): hybrid data-plane (typed RPC +
  scoped `/pb/*` forwarder); journal + three-way/LWW engine; design in
  `pwa/docs/SYNC.md`.
- **Phase 6 — admin** (`feat/admin`): Rsbuild + TanStack Start + Mantine;
  `users.role` model + `/api/admin/*` guards.
- **Phase 7 — platform deployment + feedback**, deployed 2026-09-04: bm2 +
  Caddy + backups (D10/D11); runbook `docs/DEPLOY-VPS.md`; feedback sidecar
  deployed with the phase, then **removed 2026-09-05 (D13)**.
- **Cross-cutting — shared i18n catalog** (`feat/shared-i18n-catalog`):
  catalog relocated to `common/`; pwa + web compile it via Paraglide; drift
  guard covers all locales. Web locale routing delivered 2026-09-05 on
  `mvp-web` (URL strategy, `paraglideMiddleware` + AsyncLocalStorage).

## Verification gates (every phase)

1. `bun run typecheck` (root, covering all landed modules)
2. `bun run lint` / `bun run check` (Biome, whole repo)
3. Module test suites (see phase lists)
4. Devdoc present/updated (module README + the product roadmap's checkboxes)
5. No secrets committed; root `.env.example` updated when a variable is added (D9)

## Open risks

- **Hono RPC type instantiation** — keep the exported `AppType` small (chain
  only what clients need), pin `hono` versions across bff/clients (workspace
  catalog), and watch TS project-reference setup, per Hono's own monorepo
  caveats.
- **PB schema import is wholesale-replace** — migrations must fetch → diff →
  merge; never blind-import. Idempotency test required (phase 2).
- **`UserProfile.avatar` is an inline data-URI SVG** — fine as a PB text field
  initially; revisit as PB file storage if size becomes an issue.
- **TanStack Start + Rsbuild is new** (Jun 2026) — pin versions; verify SSR +
  static prerender behavior for the marketing site early in phase 4.
- **web/admin design language** — `pwa/DESIGN.md` is PWA-scoped; marketing
  should follow brand constants from `common`, with its own lighter design
  notes.

(Deployment automation — bm2 + Caddy + backups — is **RESOLVED**, shipped in
phase 7 / D10-D11; see [DEPLOY-VPS.md](DEPLOY-VPS.md). The sync data-plane
risk is **RESOLVED** in phase 5, see `pwa/docs/SYNC.md`.)

## Gotchas (tribal knowledge — don't rediscover them)

- hc per-request headers go in the second `options` arg (hono 4.13); the PB
  SDK attaches `Authorization` only when `authStore.isValid`; `expand` rides
  the query string (ignored in create bodies); failed CREATE **rules** surface
  as 400, not 403; `created`/`updated` autodate fields are on every data
  collection (phase-5 sync needs them).
- Create rules are evaluated against the **hydrated record** — `team.owner =
  …` works and `@request.body.<relationField>` resolves for membership checks;
  don't traverse further into `@request.body` relations (body values are ids).
- TanStack Start runs `beforeLoad` **server-side** during SSR, where the
  localStorage token is invisible — a guard there bounces every hard
  navigation to `/login` (stuck). Auth guards must be client-side mount
  effects; post-login navigation must be `router.navigate` (a full reload
  re-enters the SSR token-less redirect dance).
- web dev binds IPv6 `[::1]` (rsbuild default) — use `localhost`, not
  `127.0.0.1`.
- bm2 resolves ecosystem `script:` paths against the config dir (use absolute
  launchers); systemd/sudo strip `~/.bun/bin` from PATH ("bun: not found");
  fresh-install schema reconcile must land existing-collection field drift
  BEFORE creating views (view queries are validated by execution); dotenv
  files are unsafe to `sh`-source — wrappers load env via `bun --env-file`.