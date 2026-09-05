# AGENTS.md — @remindit/common

Shared brand constants, domain entities, and the translation catalog
(`@remindit/common`). Repo-wide rules live in the root [AGENTS.md](../AGENTS.md).

## Rules

- No build step — `exports` point at TypeScript source (`./src/index.ts`, `./src/models/types.ts`, `./src/brand.ts`); consumers compile it.
- Brand assets (logo SVGs) live in `assets/` and are imported as strings with the `?raw` query — supported natively by Bun and Rspack. Because jiti-based config loaders can't resolve `?raw`, the logo constants are exposed via the `@remindit/common/brand` subpath (asset-free constants stay in the root export). See [README.md](README.md).
- **Platform seed dataset (`@remindit/common/seeds`):** `seeds/platform.json` (curated personas + teams + per-team shopping content) + the typed loader in `src/seeds/` (`hash.ts` — pwa-compatible FNV-1a id scheme, `history.ts` — deterministic mulberry32 simulator, `avatar.ts` — initials data-URIs) shared by every module's demo/test environment. The consumer is `bff` (`bun run seed:bff`); keep the pwa id scheme here in sync with `pwa/seed/hash.ts` so seeded groups reconcile identically.
- **Translation catalog (inlang):** `messages/{locale}.json` plus the inlang project in `project.inlang/settings.json` are the single source of truth for UI strings across every module (pwa and web both compile from them into their own gitignored `src/paraglide`). Change the catalog here, never in a consumer's generated output.
  - Adding/editing a key: edit `messages/en.json` (baseLocale, authoritative) **and** `messages/ro.json` in the same change with identical `{tokens}` — the drift guard (`pwa/tests/i18n-drift.test.ts`, run by `bun run i18n:check`) enforces parity. `de/fr/uk` fall back to English for missing keys, so they can lag.
  - Kick-starting a new locale (or filling drafts): `bun run kickstart:locale -- <locale,...> [model]` (local Ollama; see `scripts/kickstart-locale.ts` and `pwa/docs/DEV.md` §Internationalization). Scripts are bun-run dev tools — not part of the typed package surface (`tsconfig` covers `src` only), section is also lint-clean.
- Scripts (`typecheck`, `kickstart:locale`). Run from the repo root: `bun run typecheck` (covers this module + pwa/web/bff/admin) or `bun run kickstart:locale`.
- No lint or test config yet; document module-specific tooling here when the module grows.
