/**
 * Ambient declarations for the admin module (mirrors web/src/env.d.ts):
 * `*.svg?raw` (brand via @remindit/common) + `*.css` side-effect imports.
 * PUBLIC_* env reads use `process.env` (typed via @types/node) — no
 * ImportMeta.env declaration needed since the P10 convention switch.
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}

declare module "*.css"
