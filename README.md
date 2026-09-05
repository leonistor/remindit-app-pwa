# Remindit monorepo

Bun workspace for the Remindit project.

## Modules

| Module              | Path     | Description                                                                    |
| ------------------- | -------- | ------------------------------------------------------------------------------ |
| `@remindit/pwa`     | pwa/     | Local-first shopping-list / reminders PWA — see [pwa/README.md](pwa/README.md) |
| `@remindit/common`  | common/  | Shared brand constants (name, colors, logo) + domain entities — app description in [common/DESCRIPTION.md](common/DESCRIPTION.md) |
| `@remindit/bff`     | bff/     | PocketBase + Hono backend-for-frontend — see [bff/README.md](bff/README.md)     |
| `@remindit/web`     | web/     | Marketing site (Rsbuild + TanStack Start) — see [web/README.md](web/README.md)  |
| `@remindit/admin`   | admin/   | Admin dashboard (Rsbuild + TanStack Start + Mantine) — see [admin/README.md](admin/README.md) |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the roadmap (product versions +
platform decision log) and [TODO.md](TODO.md) for active work.

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
[docs/ROADMAP.md §5](docs/ROADMAP.md)).

See [AGENTS.md](AGENTS.md) for the development guide and [pwa/DESIGN.md](pwa/DESIGN.md)
for the design system.

## Local HTTPS dev (macOS only)

A brew-services [Caddy](https://caddyserver.com) reverse proxy serves every
module over HTTPS with production-style subdomains — required for
HTTPS-only features (service worker / PWA install, secure cookies). Full
setup, troubleshooting, and design notes:
[docs/CADDY-LOCAL.md](docs/CADDY-LOCAL.md).

| URL | Module |
| --- | --- |
| `https://pwa.remindit.localhost` | pwa |
| `https://web.remindit.localhost` | web |
| `https://admin.remindit.localhost` | admin |
| `https://bff.remindit.localhost` | BFF |

One-time setup (the env overrides match the brew service's storage, so the
Keychain gets the CA root the background Caddy actually uses):

```sh
brew install caddy && brew services start caddy
HOME=/opt/homebrew/var/lib XDG_DATA_HOME=/opt/homebrew/var/lib caddy trust
```

Daily workflow — Caddy in the background, dev servers on their usual ports;
proxied and direct-port URLs work simultaneously:

```sh
brew services start caddy   # once per login session
bun run dev:all
```

PocketBase is not proxied (internal-only per D2) — its admin UI stays on
`http://127.0.0.1:8090/_/`.

## Repo-level (non-module) files

- `.opencode/`, `opencode.jsonc`, `skills-lock.json`, `.hive/` — opencode memory & config
- `.zed/` — Zed editor config
- `LICENSE.txt` — license
