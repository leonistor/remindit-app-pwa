# AGENTS.md

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

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
- Rstest: https://rstest.rs/llms.txt

## Tools

### Rstest

- Run `bun run test` to run tests
- Run `bun run test:watch` to run tests in watch mode

### Biome

- Run `bun run lint` to lint your code
- Run `bun run format` to format your code

## Skills

- see [.agents/skills](.agents/skills)
