// Brand constants for RemindIt — the single source of truth shared by all
// modules (PWA manifest + favicon generation today, web/marketing later).
//
// The logo SVGs live as asset files in ../assets/ and are imported as raw
// strings via the `?raw` query (typed by src/env.d.ts). `?raw` is supported
// natively by the Bun runtime (scripts) and Rspack-based bundlers (app
// bundles, rstest test bundles) — but NOT by jiti-based config loaders, so
// this module is exposed as the `@remindit/common/brand` subpath, kept out of
// the root export consumed by rsbuild.config.ts. Consumers that need
// file-like input (the favicon pipeline) wrap the strings in
// Buffer.from(...); the PWA rewrites its public/ copies from these constants
// on every favicons run so the served assets can never drift from the brand
// source.

import logoSvg from "../assets/remindit-icon.svg?raw"
import logoMaskableSvg from "../assets/remindit-icon-maskable.svg?raw"

export * from "./constants"

/** The round RemindIt logo (512x512 canvas, 200x200 viewBox). */
export const BRAND_LOGO_SVG = logoSvg

/** Maskable-safe variant: same mark inset into the safe zone (80% scale). */
export const BRAND_LOGO_MASKABLE_SVG = logoMaskableSvg
