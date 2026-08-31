# Workspace plan (v5–v6) — for discussion

> **Status: proposal, not decided.** Two delivery plans are drafted below (big bang vs gradual).
> Outcome of the planning session on 2026-08-31; pick one before any restructuring work starts.

## Why a workspace

v5 (multi-user, sync) needs shared data models and a backend; v6 adds a website, tester
feedback, analytics, AI/MCP and a native shell. A Bun monorepo with one module per concern
avoids a painful retrofit later. Only the PWA exists today (`remindit-app-pwa` repo).

## Modules

| Module | Purpose | Stack |
|---|---|---|
| `pwa` | the current shopping-list PWA | rsbuild + Shark UI + nanostores (existing) |
| `common` | data models, design elements | TS only, zero runtime deps |
| `server` | profiles/groups store, auth, sync, notifications | Fluxbase (single binary) + pg0 |
| `website` | marketing pages | rsbuild + TanStack Start |
| `webapp` | registration, user dashboards (user-facing only) | rsbuild + TanStack Start + Mantine |
| `product-management` | tester feedback | Apache Answer (single binary) |
| `analytics` | app + web analytics | OpenObserve (single binary, single-node) |
| `agents` | "chat with remindit", MCP | Fluxbase MCP custom tools (+ optional Bun MCP) |
| `tauri` | native apps | Tauri v2 wrapping the pwa build |

Infra admin stays on Fluxbase's built-in dashboard; `webapp` never duplicates it.

## Validated research findings

- **TanStack Start + Rsbuild is officially supported** (since Jun 2026, `@tanstack/react-start/plugin/rsbuild`) — React and Solid, Node deployment via srvx.
- **Fluxbase** — single-binary Go BaaS (Supabase-alternative), AGPL-3 (commercial licenses available). Postgres 15+ is the only dependency. Auth (JWT/OAuth/SAML/2FA), realtime per-table subscriptions (LISTEN/NOTIFY), storage, edge functions (Deno), jobs, email, webhooks, migrations + branching, **built-in MCP server with custom tools + knowledge bases**.
- **pg0** — zero-config single binary bundling PostgreSQL 18 + pgvector; named instances, persistent data in `~/.pg0/`. Perfect for local dev and single-binary prod parity.
- **Apache Answer** — single Go binary Q&A platform; its DB can live in the pg0-managed Postgres (separate database).
- **OpenObserve** — single Rust binary observability platform (logs/metrics/traces/RUM/dashboards/alerts). Single-node mode = SQLite + local disk, **no external DB needed**. RUM gives Core Web Vitals, error tracking and session replay for both the PWA and the website. Postgres only required for HA cluster mode.

## Decisions locked so far

| Decision | Choice |
|---|---|
| Repo | **New sibling repo** `remindit/`; `remindit-app-pwa` is archived as the history reference (history stays there, README pointer added) |
| Gradual priority | v5 sync first, then v6 platform modules |
| Big-bang scope | all skeletons + infra up (runnable starters, no feature work) |
| OpenObserve mode | single-node (SQLite + local disk), HA-ready configs later if ever |
| Workspace names | bare names (`pwa`, `common`, …), not `@remindit/*` |
| Configs | duplicated-simple over smart; shared only where native (root `biome.json`, `tsconfig.base.json`) |

## Target layout (both plans)

```
remindit/
├── package.json        # workspaces: ["*"], name "remindit", private
├── bunfig.toml         # [install] linker = "hoisted"  (rsbuild/rspack/playwright-safe)
├── biome.json, tsconfig.base.json, AGENTS.md, LICENSE.txt (AGPL-3)
├── docs/               # WORKSPACE.md, ROADMAP.md, this file, DESIGN.md copy
├── .opencode/skills, .zed, opencode.jsonc   # common tooling configs
├── pwa/                # copied from remindit-app-pwa, self-contained configs
├── common/             # models + pure constants + design tokens starter
└── (server | website | webapp | product-management | analytics | agents | tauri)/
```

Conventions:

- **Shared code resolution** via plain tsconfig `paths` alias (`"common": ["../common/src"]`) in each consumer — same behavior in rsbuild and rstest, no build magic.
- **`common` stays dependency-light**: types/models, `FREQ_TO_DAYS`, recommendation tiers, brand tokens. No React, no stores, no components (Shark UI and Mantine cannot share components anyway).
- New module = directory + `package.json`; the `["*"]` workspace glob needs no root edits.
- Root scripts use `bun --filter` / per-workspace scripts; each workspace owns its rsbuild/rstest/biome configs (duplicated-simple).

## Plan A — Big bang: "all skeletons + infra up"

One coordinated pass; when it lands, all 9 workspaces exist and every binary boots. No feature work.

| Stage | Content |
|---|---|
| **0. Bootstrap** | Create `remindit/`: root configs, common skills, docs skeleton. Copy pwa → `pwa/` unchanged; old repo untouched yet. |
| **1. pwa + common green** | `bun install` (hoisted); pwa gates green (`test:quick`, `lint`, `build`). Extract `common`; pwa re-exports keep `@/stores` imports stable. Archive old repo with pointer once green. |
| **2. Seven skeletons (parallel, sub-agents)** | `website` — TanStack Start starter, one landing page, boots. `webapp` — starter + Mantine, login placeholder, boots. `server` — pg0 `remindit` instance + Fluxbase configured, migrations skeleton, healthcheck green. `product-management` — Answer running on pg0 DB, admin reachable. `analytics` — OpenObserve single-node running, RUM enabled, test event received from pwa. `agents` — Fluxbase MCP enabled + stub custom tool + docs. `tauri` — Tauri v2 pointing at pwa build, `tauri dev` smoke optional. |
| **3. Integration** | Root scripts via `bun --filter`, Biome across all, smoke rstest per workspace, docs finished (WORKSPACE.md module map, ROADMAP v5/v6 rewrite, DEV.md pointers). |

**Verification gate:** every workspace boots (dev server or binary healthy), pwa full gates green, OpenObserve receives a RUM event, Fluxbase health OK, Answer admin reachable.

**Pros:** full structure + running infra day one; the platform mental model is settled in one go; no interim restructuring later.
**Cons:** zero product value at merge time; five services to keep alive from day one; long review surface.

## Plan B — Gradual: "v5 sync first" (recommended)

Each phase independently shippable; the PWA stays releasable throughout.

| Phase | Ships | Content |
|---|---|---|
| **0. Foundation** | restructure | Identical to Plan A stages 0–1 (bootstrap, pwa + common green, old repo archived). Small, low-risk disruption — the only one. |
| **1. v5: sync** | **product value** | `server/`: pg0 + Fluxbase, schema (profiles, groups, sync tables, RLS), auth. pwa sync client: nanostores ↔ Fluxbase realtime + REST, offline-first merge, account linking to the existing local profile. Release v5. |
| **2. v6a: audience** | feedback loop | `website/` marketing (TanStack Start). `product-management/`: Apache Answer live for testers. `analytics/`: OpenObserve RUM into pwa + website. |
| **3. v6b: dashboards** | accounts UX | `webapp/`: registration, groups, user dashboards (Mantine + Fluxbase React SDK). |
| **4. v6c: agents + native** | AI + desktop | `agents/`: "chat with remindit" via Fluxbase MCP custom tools. `tauri/` shell. |

**Pros:** value ships at every phase; infra appears only when needed; failures are contained; every phase is a clean release.
**Cons:** full structure materializes over weeks; later phases revisit docs/configs as modules land.

## Watch-outs

- **Fluxbase is AGPL-3** (commercial license available) — consistent with the AGPL app; only relevant if Remindit goes commercial.
- **Git history stays in the old repo** — `git log --follow` does not cross repos; the old repo is the history archive.
- Bare workspace names can shadow same-named npm packages in transitive deps (`server`, `analytics`… exist on npm) — rename the one package only if a collision actually bites.
- Bun's default linker is now *isolated* installs — the root `bunfig.toml` (`linker = "hoisted"`) avoids rsbuild/rspack/playwright symlink surprises.
- pg0 cannot run as root (Postgres constraint) — irrelevant on macOS dev, relevant for container deployment docs.

## Decision

- [ ] Plan A — big bang
- [x] **Plan B — gradual** (my recommendation: only Phase 0 must precede feature work; the rest rides product priorities)
