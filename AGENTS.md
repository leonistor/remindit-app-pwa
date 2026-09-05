# AGENTS.md

## Repo layout

Bun workspace. App code lives in the `pwa/` module (`@remindit/pwa`); shared brand constants and domain entities live in `common/` (`@remindit/common`). Root `package.json` scripts delegate into the modules (`bun run <script>` works from the repo root). Platform modules (phased rollout, one feature branch each — see
[docs/ROADMAP.md](docs/ROADMAP.md) for the approved plan, [TODO.md](TODO.md)
for active work): `@remindit/bff`
(PocketBase + Hono), `@remindit/web` (Rsbuild + TanStack Start),
`@remindit/admin` (Rsbuild + TanStack Start + Mantine). Repo-level config:
`.opencode/`, `opencode.jsonc`, `skills-lock.json`, `.hive/`, `.zed/`,
`LICENSE.txt`.

## Module instructions

Module-specific rules live next to each module — read the one for the module you are working in before making changes:

- [pwa/AGENTS.md](pwa/AGENTS.md) — app module (commands, Shark UI, docs, testing, lint/typecheck)
- [common/AGENTS.md](common/AGENTS.md) — shared entities & constants (source-only, typecheck)

## MCP servers (opencode.jsonc)

| Server | Purpose | When to use |
| --- | --- | --- |
| `ark-ui` | Ark UI docs search, props, examples, styling data-attributes | Shark UI work — Shark wraps Ark UI, so Ark's prop/styling data is authoritative. Feature code still imports Shark wrappers only. |
| `chrome-devtools` | Chromium control + performance traces, Lighthouse audits, CPU/network throttling, heap snapshots | PWA performance/accessibility audits and runtime debugging. |
| `playwright` | Headless chromium DOM automation via a11y snapshots | Manual browser flows that complement the Playwright suites (`bun run test:e2e`). |
| `pocketbase` | PocketBase schema/collection/record ops, API-rule testing, logs, backups | bff/ work only (schema reconcile, rule testing — never hand-edit collections in the PB Admin UI). Kept enabled via the root `.env` wrapper; see comment in opencode.jsonc. |
| `crawlberg` | Web scrape/crawl/map/batch | Mostly covered by the built-in webfetch/websearch tools; use for multi-page crawls. |

Both browser MCPs are kept deliberately: chrome-devtools owns performance tooling, playwright owns snapshot-driven automation. Together they are the largest context cost (~55 tool schemas) — drop one first if context pressure matters.

## Skills (.opencode/skills)

Project skills live in `.opencode/skills/` (the only path opencode.jsonc reads), tracked in `skills-lock.json`. Load on demand:

| Skill | When to load |
| --- | --- |
| `shark-ui` | Shark/Ark UI components — overlays, menus, collection controls, Field/forms, Tailwind v4 tokens |
| `nanostores` | PWA state architecture — atoms, maps, computed stores |
| `rsbuild-best-practices` | rsbuild.config.ts, bundling, assets, build debugging |
| `rstest-best-practices` / `rstest-debugging` | Writing Rstest tests / diagnosing runner, build, or performance issues |
| `vercel-react-best-practices` | React performance patterns (data fetching, bundle size) |
| `hono` | bff/ — Hono routes, RPC typing, middleware, Zod validation (official `honojs/skills`) |
| `tanstack-start` | web/ + admin/ — TanStack Start/Router patterns (official TanStack org) |
| `mantine-form` / `mantine-combobox` | admin/ — Mantine form & combobox components (official Mantine org) |
| `tailwind-4-docs` | Tailwind v4 specifics beyond shark-ui's token coverage |

Useful globals (`~/.agents/skills`): `bun` (repo default runtime), `pocketbase-best-practices` (bff/), `frontend-design` (DESIGN.md work), `customize-opencode` (only when editing `.opencode/` / opencode.jsonc).

Gotcha: `npx skills add <pkg>@<skill> -y` installs into `.agents/skills/` (the CLI's canonical dir, not read by this repo's opencode config) — move the skill folder into `.opencode/skills/` afterwards and keep the lock entry.

## Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Cross-cutting

- `bun run typecheck` (repo root) covers both modules: `pwa/` then `common/`.
- Root scripts are pass-throughs to `pwa/`; module-owned tooling is documented in the module AGENTS.md files.

## Platform conventions (adding modules)

New modules (`bff`, `web`, `admin` — phased rollout in [docs/ROADMAP.md](docs/ROADMAP.md)):

- Bun workspace package named `@remindit/<module>`, `"type": "module"`, own
  `dev/build/test/typecheck/lint` scripts, plus module `AGENTS.md` +
  `README.md` (devdoc). Biome covers the whole repo automatically
  (`biome.json` `files.includes: **`); root `bun run typecheck` gains the
  module when it lands.
- **Env (D9):** one root `.env` (gitignored) + committed root `.env.example`
  — no per-module env files. Root delegation scripts launch env-dependent
  processes with `cd <module> && bun --env-file=../.env run <script>` (verified:
  vars propagate into children; Rsbuild inlines `PUBLIC_*` from process.env).
