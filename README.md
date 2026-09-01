# Remindit monorepo

Bun workspace for the Remindit project.

## Modules

| Module              | Path     | Description                                                                    |
| ------------------- | -------- | ------------------------------------------------------------------------------ |
| `@remindit/pwa`     | pwa/     | Local-first shopping-list / reminders PWA — see [pwa/README.md](pwa/README.md) |
| `@remindit/common`  | common/  | Shared brand constants (name, colors, logo) + domain entities                   |

Planned: `@remindit/web` (marketing website).

## Usage

All package scripts are runnable from the repo root — each one delegates into
the owning module, so you never need to `cd` first:

```sh
bun install     # installs every workspace
bun run dev     # pwa dev server
bun run build   # pwa production build
bun run test    # pwa test suite
```

See [AGENTS.md](AGENTS.md) for the development guide and [pwa/DESIGN.md](pwa/DESIGN.md)
for the design system.

## Repo-level (non-module) files

- `.opencode/`, `opencode.jsonc`, `skills-lock.json`, `.hive/` — opencode memory & config
- `.zed/` — Zed editor config
- `LICENSE.txt` — license
