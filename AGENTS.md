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
