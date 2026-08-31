# AGENTS.md

## Rules

- check [docs/DEV.md](docs/DEV.md) before making changes or adding new features
- elvaluate the local project skills: [.opencode/skills](.opencode/skills)

## Commands

- `bun run dev` - Start the dev server
- `bun run build` - Build the app for production
- `bun run preview` - Preview the production build locally

## Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## UI framework

Our primary UI framework is **Shark UI** — a shadcn-style registry built on top of [Ark UI](https://ark-ui.com). Components in `src/components/ui/*` are Shark wrappers (several import from `@ark-ui/react` internally). **Feature code must consume the Shark wrappers, never import `@ark-ui/react` directly.** Add missing primitives via `bunx shadcn add @shark/<component>` (registry config in `components.json`). See `docs/DEV.md` §UI components (Shark UI).

## Docs

- [DESIGN.md](DESIGN.md) — design system (contributors, current look as shipped)
- [docs/DEV.md](docs/DEV.md) — development & state architecture
- [docs/DEMOS.md](docs/DEMOS.md) — demo video generator (scenarios, gotchas, release flow)
- [docs/DEV-COMPONENTS.md](docs/DEV-COMPONENTS.md) — Shark UI registry vs custom split
- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
- Rstest: https://rstest.rs/llms.txt

## Tools

### Rstest

Progressive test suites — pick the one that matches the moment (see `docs/DEV.md` §Testing):

- `bun run test:quick` — fast unit layer (`src/lib` + `tests/stores`). Use in the dev loop after a change.
- `bun run test` — every Rstest test. Use pre-commit.
- `bun run test:changed` — change-aware: runs tests related to changed files (falls back to the full suite when no related set resolves).
- `bun run test:watch` — watch mode.
- `bun run test:e2e` — Playwright against the dev server (`e2e/`).
- `bun run test:e2e:prod` — Playwright against a production preview (`e2e-prod/`); builds first.
- `bun run test:pre` — all Rstest + both Playwright suites (release gate).

### Biome

- Run `bun run lint` to lint your code
- Run `bun run format` to format your code
- Run `bun run check` to lint, format, and organize imports (applies fixes with `--write --unsafe`; see `biome.json: assist.actions.source.organizeImports`)
