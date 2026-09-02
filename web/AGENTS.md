# AGENTS.md — @remindit/web

Module rules for the `web/` workspace (`@remindit/web`). Repo-wide rules live
in the root [AGENTS.md](../AGENTS.md); the phased rollout plan in
[docs/ROADMAP.md](../docs/ROADMAP.md) (this module: phase 4).

## Rules

- **Rsbuild + TanStack Start**: `rsbuild.config.ts` chains `pluginReact()`
  then `tanstackStart()` (react's plugin must come after start's — TanStack
  docs). File-based routes in `src/routes/`; `src/routeTree.gen.ts` is
  **generated** — never edit it (biome excludes it).
- **Brand from `@remindit/common/brand`** — name, colors, and the logo SVG
  (raw string via `?raw`); never hardcode brand values or copy assets here.
- **Env (D9):** `PUBLIC_BFF_URL` (server-side stats fetch),
  `PUBLIC_PWA_URL` (download CTA), `WEB_PORT` (dev server, default 3200).
  Read through `process.env` — no module env file.
- **Minimal BFF use**: only the public `/api/stats` endpoint (SSR server
  function, degrades to `null` counts when the BFF is down — never a 500).
- `*.svg?raw` / `*.css` ambient declarations live in `src/env.d.ts`.

## Commands

- `bun run dev` — rsbuild dev server (SSR + HMR), port 3200
- `bun run build` — production build (client + SSR server bundle)
- `bun run preview` — preview the production build
- `bun run typecheck` — `tsc --noEmit --pretty` (needs `routeTree.gen.ts` —
  run a dev/build once on a fresh clone)
- `bun run lint` / `bun run check` — Biome (repo-wide config)

Run from the repo root: `bun run dev:web`, `bun run build:web`, or combined
`bun run dev:all` (pwa + bff + web).

## Docs

- [README.md](README.md) — devdoc (pages, data flow, deployment notes)
- [docs/ROADMAP.md](../docs/ROADMAP.md) — approved plan + decision log
