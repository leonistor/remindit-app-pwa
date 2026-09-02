# AGENTS.md

## Repo layout

Bun workspace. App code lives in the `pwa/` module (`@remindit/pwa`); shared brand constants and domain entities live in `common/` (`@remindit/common`). Root `package.json` scripts delegate into the modules (`bun run <script>` works from the repo root). Planned future modules (phased rollout, one feature branch each — see
[docs/ROADMAP.md](docs/ROADMAP.md) for the approved plan): `@remindit/bff`
(PocketBase + Hono), `@remindit/web` (Rsbuild + TanStack Start),
`@remindit/admin` (Rsbuild + TanStack Start + Mantine). Repo-level config:
`.opencode/`, `opencode.jsonc`, `skills-lock.json`, `.hive/`, `.zed/`,
`LICENSE.txt`.

## Module instructions

Module-specific rules live next to each module — read the one for the module you are working in before making changes:

- [pwa/AGENTS.md](pwa/AGENTS.md) — app module (commands, Shark UI, docs, testing, lint/typecheck)
- [common/AGENTS.md](common/AGENTS.md) — shared entities & constants (source-only, typecheck)

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
