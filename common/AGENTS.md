# AGENTS.md — @remindit/common

Shared brand constants and domain entities (`@remindit/common`). Repo-wide rules live in the root [AGENTS.md](../AGENTS.md).

## Rules

- No build step — `exports` point at TypeScript source (`./src/index.ts`, `./src/models/types.ts`, `./src/brand.ts`); consumers compile it.
- Brand assets (logo SVGs) live in `assets/` and are imported as strings with the `?raw` query — supported natively by Bun and Rspack. Because jiti-based config loaders can't resolve `?raw`, the logo constants are exposed via the `@remindit/common/brand` subpath (asset-free constants stay in the root export). See [README.md](README.md).
- Only script: `typecheck`. Run from the repo root (`bun run typecheck`) — it covers this module and `pwa/`.
- No lint or test config yet; document module-specific tooling here when the module grows.
