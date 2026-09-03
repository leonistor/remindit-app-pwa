# AGENTS.md — @remindit/bff

Module rules for the `bff/` workspace (`@remindit/bff`). Repo-wide rules live
in the root [AGENTS.md](../AGENTS.md); the roadmap in
[docs/ROADMAP.md](../docs/ROADMAP.md) (this module: platform phases 1–3 plus
the sync/admin slices in phases 5–6).

## Rules

- **Layering (D8):** `routes → services → repositories` — routes never import
  the PocketBase client; PB concerns stay in `src/repositories/`, application
  logic in `src/services/`, request/response shapes in `src/contracts.ts`
  (Zod schemas shared by services and clients).
- **PocketBase is internal (D2):** it never becomes a public surface. Clients
  consume the typed Hono API via `hc<AppType>`; `AppType` is exported from
  `src/app.ts` (the `"."` / `"./api"` subpaths) and must be kept small.
- **Env (D9):** read through `src/env.ts` only; values come from the single
  root `.env` — no module env file. Never hardcode creds.
- **Schema ownership:** the served PB schema is created by the migration
  scripts (phase 2) built on `@remindit/common` — never hand-edit collections
  in the PB Admin UI; use pocketbase-mcp for inspection/tests only.
- Tests use `bun:test` and exercise the app via `app.request()` or a real
  `Bun.serve` on a random port — no global test config.

## Commands

- `bun run dev` — PocketBase (via `@fadlee/pocketbase-bin`) + Hono; reuses an
  already-running PB; first run downloads the PB binary
- `bun run start` — Hono only (`src/index.ts`)
- `bun run migrate` — reconcile PB schema towards `src/schema/collections.ts`
  (idempotent; run twice, second run must be a no-op — see docs/SCHEMA.md)
- `bun run test` — bun test suite
- `bun run typecheck` — `tsc --noEmit --pretty`
- `bun run lint` / `bun run check` — Biome (repo-wide config)

Run from the repo root: `bun run dev:bff`, `bun run test:bff`, or combined
`bun run dev:all` (pwa + bff).

## Docs

- [README.md](README.md) — devdoc (architecture, endpoints, dev flow)
- [docs/ROADMAP.md](../docs/ROADMAP.md) — approved plan + decision log
