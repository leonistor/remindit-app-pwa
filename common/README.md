# @remindit/common

Shared brand constants and domain entities used by every Remindit module (PWA
today; web, future server). Framework-agnostic by design: no React, no UI kit,
no DOM types.

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
  `./src/models/types.ts`); consumers compile it. Only script: `typecheck`,
  run from the repo root (`bun run typecheck`) — it covers this module and
  `pwa/`.
