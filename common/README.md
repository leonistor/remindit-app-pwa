# @remindit/common

Shared brand constants, domain entities, and the translation catalog used by
every Remindit module (pwa, web, bff). Framework-agnostic by design: no
React, no UI kit, no DOM types.

## Translation catalog (i18n)

`messages/{locale}.json` (inlang message format, flat files) plus the inlang
project in `project.inlang/settings.json` are the **single source of truth**
for UI strings. `en` is the `baseLocale` (authoritative); `ro` is shipped;
`de`/`fr`/`uk` are drafts that fall back to English for missing keys.

Consumers compile the catalog with **Paraglide JS** into their own gitignored
output — the catalog is never imported directly:

- `pwa/` — `scripts/compile-i18n.ts` → `pwa/src/paraglide`, strategy
  `["localStorage", "preferredLanguage", "baseLocale"]` (user-facing language
  pickers). See `pwa/docs/DEV.md` §Internationalization.
- `web/` — `scripts/compile-i18n.ts` → `web/src/paraglide`, strategy
  `["baseLocale"]` (English-only, SSR-safe). See `web/README.md`.

Editing a message: change `messages/en.json` **and** `messages/ro.json`
together (same `{tokens}`) and run `bun run i18n:compile`; the drift guard
(`pwa/tests/i18n-drift.test.ts`, `bun run i18n:check`) enforces en↔ro parity.
Kick-starting a new locale: `bun run kickstart:locale -- de,fr translategemma:12b`
(needs a running [Ollama](https://ollama.com); writes machine-translated
DRAFTS that need a human pass).

## Brand assets

`src/brand.ts` is the brand source of truth: `BRAND_NAME`, `BRAND_COLOR`
(`#262626`), `BRAND_BACKGROUND_COLOR` (`#ffffff`), and the logo SVGs
(`BRAND_LOGO_SVG`, `BRAND_LOGO_MASKABLE_SVG`).

The logo SVGs live as asset files in [`assets/`](./assets/) — kept under their
served names, byte-for-byte — and are imported as raw strings via the `?raw`
query:

```ts
import logoSvg from "../assets/remindit-icon.svg?raw"
```

Why `?raw`: it is supported natively by the Bun runtime (e.g.
`pwa/scripts/generate-favicons.ts` — a plain `.svg` import would yield a file
path instead) and by Rspack-based bundles (rstest test bundles, app bundles),
which inline the raw string via `asset/source`.

**Why a `./brand` subpath:** jiti-based config loaders (Rsbuild's `loadConfig`
under Node, used by the rstest adapter for `rsbuild.config.ts`) cannot resolve
`?raw` asset imports. So the asset-free plain constants live in
`src/constants.ts` and are re-exported from the root (`@remindit/common`,
consumed by `pwa-manifest.config.ts` → `rsbuild.config.ts`), while `src/brand.ts`
— which carries the SVG imports — is exposed only as `@remindit/common/brand`
and must stay out of jiti-loaded config chains. TypeScript resolves the `?raw`
import through an ambient `declare module "*.svg?raw"` declaration
(`src/env.d.ts`; the PWA declares the same wildcard in its own env.d.ts).

Downstream flow (see `pwa/DESIGN.md`): `pwa/scripts/generate-favicons.ts`
rewrites the served copies `pwa/public/remindit-icon*.svg` from these constants
on every run, so the served assets can never drift from the brand source —
**edit artwork in `assets/`, never in `pwa/public/`**. A drift-guard test
(`pwa/tests/brand.test.ts`) asserts the copies stay byte-identical.

New brand assets of any type belong in `assets/`, imported with the same
pattern (add an ambient declaration for the extension/query if needed) — and,
if they must be reachable from config loaders, behind an asset-free subpath.

## Rules

- No build step — `exports` point at TypeScript source (`./src/index.ts`,
  `./src/models/types.ts`, `./src/brand.ts`, `./src/seeds/index.ts`); consumers
  compile it. Only scripts: `typecheck`, run from the repo root (`bun run
  typecheck` — covers this module and `pwa/`), and `kickstart:locale`.
