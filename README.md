# Remindit monorepo

Bun workspace for the Remindit project.

## Modules

| Module              | Path     | Description                                                                    |
| ------------------- | -------- | ------------------------------------------------------------------------------ |
| `@remindit/pwa`     | pwa/     | Local-first shopping-list / reminders PWA — see [pwa/README.md](pwa/README.md) |
| `@remindit/common`  | common/  | Shared brand constants (name, colors, logo) + domain entities                   |
| `@remindit/bff`     | bff/     | PocketBase + Hono backend-for-frontend — see [bff/README.md](bff/README.md)     |

Planned: `@remindit/bff` (PocketBase + Hono), `@remindit/web` (marketing,
Rsbuild + TanStack Start), `@remindit/admin` (Rsbuild + TanStack Start +
Mantine) — see [docs/ROADMAP.md](docs/ROADMAP.md) for the phased plan.

## Usage

All package scripts are runnable from the repo root — each one delegates into
the owning module, so you never need to `cd` first:

```sh
bun install     # installs every workspace
bun run dev     # pwa dev server (alias of dev:pwa; per-module dev:* as modules land)
bun run build   # pwa production build
bun run test    # pwa test suite
```

Environment: **one repo-root `.env`** for all modules — copy `.env.example`
(gitignored `.env` holds local values; prod secrets come from the VPS). Root
`dev:*`/`build` scripts inject it via `bun --env-file=../.env` (see
[docs/ROADMAP.md §4](docs/ROADMAP.md)).

See [AGENTS.md](AGENTS.md) for the development guide and [pwa/DESIGN.md](pwa/DESIGN.md)
for the design system.

## Repo-level (non-module) files

- `.opencode/`, `opencode.jsonc`, `skills-lock.json`, `.hive/` — opencode memory & config
- `.zed/` — Zed editor config
- `LICENSE.txt` — license
