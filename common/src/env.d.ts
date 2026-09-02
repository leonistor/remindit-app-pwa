/**
 * Imports a file's raw source as a string via the `?raw` query (e.g. the logo
 * SVGs in ../assets/, imported by src/brand.ts). `?raw` is supported natively
 * by every consumer toolchain of this module — the Bun runtime (scripts) and
 * Rspack-based bundlers (Rsbuild config bundle, app bundles, rstest) — so no
 * loader configuration is needed anywhere.
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}
