# AGENTS.md — @remindit/common

Shared brand constants and domain entities (`@remindit/common`). Repo-wide rules live in the root [AGENTS.md](../AGENTS.md).

## Rules

- No build step — `exports` point at TypeScript source (`./src/index.ts`, `./src/models/types.ts`); consumers compile it.
- Only script: `typecheck`. Run from the repo root (`bun run typecheck`) — it covers this module and `pwa/`.
- No lint or test config yet; document module-specific tooling here when the module grows.
