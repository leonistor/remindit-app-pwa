# Platform roadmap — bff / web / admin

Cross-session plan for growing the Remindit Bun workspace beyond `pwa` +
`common`. Each phase below is one feature branch, merged only after its
verification gate. Check off items as they land; this file is the single
source of truth for sequencing and status (see also root [README.md](../README.md)
module table).

Status: **plan approved, not started** (2026-09-02).

---

## 1. Approved decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Groups | **Shared workspaces** — a group owns categories, items and lists; users are members with roles (owner / member) | Enables shared shopping lists; drives the whole collection schema |
| D2 | Topology | **Everything via Hono** — PocketBase is never public (127.0.0.1); Hono is the only public surface. App-level concerns are a **typed Hono API** (Hono RPC + Zod); whether the PWA sync data-plane re-uses PB's record API via a scoped `/pb/*` forwarder or bespoke endpoints is **decided in phase 5** (hybrid recommended, see §8) | PB stays internal; one public surface, one auth guard; typed contract for frontends |
| D3 | Hosting | **Same VPS** as the PWA static bundle — PB binary + Hono process behind a reverse proxy, SQLite volume on disk | One server to operate; PB needs a persistent process + local SQLite |
| D4 | Notifications | **Channel undecided** — schema reserves a `notifications` collection; channel (Web Push / email / realtime-only) decided in phase 5+ | No premature commitment |
| D5 | Stack | BFF = **PocketBase + Hono** on Bun (Hono over Elysia: Web-standard model + runtime portability, per [analysis](https://chatgpt.com/share/6a978f02-8e68-83eb-b3e2-0a5d4a602c63)); web/admin = **Rsbuild + TanStack Start** (official `@tanstack/react-start/plugin/rsbuild` adapter); admin UI = **Mantine** | Per user brief + TanStack blog (Jun 2026): Start supports Rsbuild 2 first-class |
| D6 | Tooling | `@fadlee/pocketbase-bin` (bunx-runnable PB binary manager, version-pinned via env); `gaspechak-pocketbase-mcp` as agent MCP server for schema/record ops | Per user brief |
| D7 | Schema source of truth | **`bff` consumes `@remindit/common`** to build and migrate PB collections | Domain types live in common; PB schema must never drift from them |
| D8 | BFF layering | `routes → services → repositories` inside the bff — routes never call the PB SDK directly; PB JS SDK is **server-side only** (`autoCancellation(false)`, `pb.filter()` for any untrusted filter input). Frontends consume the typed contract via Hono RPC (`hc<AppType>`) + Zod validation; `AppType` exported from a small `@remindit/bff/api` subpath and kept deliberately small | From the ChatGPT analysis: "PocketBase concerns stay in the service layer; application concerns stay in the BFF" — swap-ready infrastructure |
| D9 | Environment | **One `.env` + one committed `.env.example`, both at the repo root** — all modules consume from there; no per-module env files | Single place to configure; no drift between modules; secrets live in one gitignored file (prod secrets come from the VPS environment, never from the repo) |

## 2. Architecture

```
                       VPS (same host)
┌──────────────────────────────────────────────────────┐
│ reverse proxy (Caddy/nginx, TLS)                     │
│   /            → pwa static (dist/, existing deploy) │
│   app.example  → web static/SSR (TanStack Start)     │
│   admin.example→ admin static/SSR (TanStack Start)   │
│   api.example  → Hono BFF (Bun.serve, :<BFF_PORT>)   │
│                    │  /api/* → typed Hono RPC       │
│                    │           (Zod, PB SDK         │
│                    │            server-side)        │
│                    │  /pb/*  → scoped data-plane    │
│                    │           forwarder → PB       │
│                    │           (phase 5 decision)   │
└──────────────────────────────────────────────────────┘
```

- **Clients** (`web`, `admin`) talk to the **typed Hono API** (`/api/*`, Hono
  RPC + Zod — see D8); they never see PB's API shape. **`pwa`** additionally
  needs an efficient sync data-plane (bulk CRUD + realtime SSE across several
  collections): whether that is a scoped authenticated `/pb/*` forwarder
  (PB SDK client-side with `baseUrl = BFF_URL`) or bespoke BFF endpoints with
  server-side PB SDK + custom SSE is an explicit **phase 5 decision** (§8).
- **Hono customs** (`/api/*`): auth sessions, groups management, public stats
  for the marketing site (total users/groups), notification dispatch (later),
  health — all backed by the server-side PB SDK through the service layer.
- **Migrations** run from the repo against PB's admin API; PB itself is
  never a migration target by hand (no drift).

## 3. Workspace layout (target)

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

## 4. Environment convention (D9)

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

## 5. Dev experience

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

## 6. Phases — one feature branch each

### Phase 0 — workspace foundations · `feat/platform-foundations` ✅
- [x] `docs/ROADMAP.md` (this file) + README/AGENTS pointers
- [x] Root scripts: `dev` is an alias of `dev:pwa`; env-bearing delegations use `cd <module> && bun --env-file=../.env run <script>` (D9; verified — vars propagate, missing `.env` tolerated). `dev:bff|web|admin|all` land with their modules (nothing to point at yet); `typecheck` composition exists and gains modules as they land
- [x] Root `.env.example` committed with all planned + existing vars (§4); the **tracked** `pwa/.env.example` was merged into it and removed; local `pwa/.env` migrated to root `.env` (no `.gitignore` change needed — the existing `.env` pattern already ignores it everywhere). Verified end-to-end: Rsbuild inlines `PUBLIC_*` from process.env (marker-value build test)
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
- Note: root `dev:all` runs pwa + bff via `concurrently` (root devDep, per §5)

### Phase 2 — schema & migrations · `feat/bff-schema`
- [ ] `bff/src/schema/`: PB collections JSON builders importing `@remindit/common` (frequencies, sentinels, types)
- [ ] `bff/scripts/migrate.ts`: superuser login from env → fetch current schema → **merge-diff** (PB import replaces wholesale, so diff per collection first) → import; idempotent, safe on re-run
- [ ] API rules per §3 table; seed `uncategorized` handling
- [ ] Devdoc `bff/docs/SCHEMA.md` (mapping table above, kept in sync)
- Gate: fresh `pb_data` migrate → `pb_schema` (MCP) review; rules exercised via `pb_rules_test`; CI-able idempotency test (run twice → no drift)

### Phase 3 — auth & groups API · `feat/bff-auth-groups`
- [ ] `/api/auth/*` (register, login, logout, me) — pass-through of PB auth tokens with sameSite cookie option for web
- [ ] `/api/groups/*` CRUD + member/role management (owner-only mutations) — all via Hono RPC with Zod schemas (the `AppType` contract frontends consume)
- [ ] Notification stub endpoints (`/api/notifications/*` listed, no channel)
- [ ] Devdoc `bff/docs/API.md`; bun test coverage for rules/boundaries
- Gate: typecheck + lint + tests; MCP `pb_rules_test` for member/owner matrix

### Phase 4 — web marketing site · `feat/web-marketing`
- [ ] `web/`: Rsbuild + `@tanstack/react-start` (rsbuild adapter), SSR, brand from `@remindit/common` (incl. logo assets)
- [ ] Pages: home, features, download/PWA install CTA; SEO meta + OG tags
- [ ] Minimal BFF use: `/api/stats` (total users, total groups) with server-side cache
- [ ] Devdoc `web/README.md`; root scripts (`dev:web`, `build:web`)
- Gate: typecheck + lint + build; Playwright smoke (pattern reused from pwa)

### Phase 5 — pwa sync · `feat/pwa-sync`
- [ ] Design doc first: `pwa/docs/SYNC.md` (auth UX, offline queue, last-write-wins via `updated` timestamps, realtime transport, conflict rules per collection)
- [ ] **Decide the sync data-plane (D2/§8):** scoped authenticated `/pb/*` forwarder (PB SDK client-side) vs bespoke BFF endpoints + server-side PB SDK + custom SSE. Recommendation: hybrid — hybrid keeps PB's proven record API + realtime for bulk sync while app-level concerns stay on the typed RPC API; the analysis's "no PB SDK in clients" guidance is honored for web/admin, where it applies cleanly
- [ ] Auth UI in profile; local stores ↔ PB hydration/push; profile, items, categories, lists sync (D1: scoped to user's groups)
- [ ] Notifications consumer (channel per D4 decision, made here)
- Gate: full pwa suite (`test:pre`) + new sync tests; two-device manual scenario

### Phase 6 — admin · `feat/admin` (last priority)
- [ ] `admin/`: Rsbuild + TanStack Start + Mantine; login, registration flow, dashboards (overview, users, groups)
- [ ] Role model: `users.role` (`admin`) + BFF `/api/admin/*` guards (token role check server-side)
- [ ] Devdoc `admin/README.md`
- Gate: typecheck + lint + build + e2e smoke

## 7. Verification gates (every phase)

1. `bun run typecheck` (root, covering all landed modules)
2. `bun run lint` / `bun run check` (Biome, whole repo)
3. Module test suites (see phase lists)
4. Devdoc present/updated (module README + this file's checkboxes)
5. No secrets committed; root `.env.example` updated when a variable is added (D9)

## 8. Risks & open questions

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
