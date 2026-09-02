# AGENTS.md — @remindit/admin

Module rules for the `admin/` workspace (`@remindit/admin`). Repo-wide rules
live in the root [AGENTS.md](../AGENTS.md); the phased rollout plan in
[docs/ROADMAP.md](../docs/ROADMAP.md) (this module: phase 6).

## Rules

- **Client-side auth gating** — Bearer token in `localStorage`; guards are
  mount effects (`src/lib/auth.ts`), never `beforeLoad` (SSR executes it
  server-side without the token — see [README.md](README.md) §Auth model).
  Data fetching is client-only (`useEffect`), mirroring the users/groups
  pages.
- **API client** — `src/lib/api.ts` wraps `fetch` against `PUBLIC_BFF_URL`;
  response types mirror `bff/src/contracts.ts` (the source of truth; keep in
  sync like `pwa/src/lib/bff-api.ts`). The admin never talks to PocketBase
  directly (D2).
- **UI** — Mantine components (`@mantine/core`); brand constants from
  `@remindit/common/brand`. The admin is an internal tool: inline styles +
  Mantine, no design-system ceremony.
- `src/routeTree.gen.ts` is **generated** — never edit it (biome excludes
  it, like `web/`).
- `*.svg?raw` / `*.css` ambient declarations live in `src/env.d.ts`.

## Commands

- `bun run dev` — rsbuild dev server (SSR + HMR), port 3300
- `bun run build` — production build (client + SSR server bundle)
- `bun run preview` — preview the production build
- `bun run typecheck` — `tsc --noEmit --pretty` (needs `routeTree.gen.ts` —
  run a dev/build once on a fresh clone)
- `bun run lint` / `bun run check` — Biome (repo-wide config)

Run from the repo root: `bun run dev:admin`, `bun run build:admin`, or
combined `bun run dev:all` (pwa + bff + web + admin).

## Docs

- [README.md](README.md) — devdoc (pages, auth model, deployment notes)
- [docs/ROADMAP.md](../docs/ROADMAP.md) — approved plan + decision log
