/**
 * Ambient declarations for the admin module (mirrors web/src/env.d.ts):
 * `*.svg?raw` (brand via @remindit/common) + `*.css` side-effect imports.
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}

declare module "*.css"

// Rsbuild's PUBLIC_* env convention (see root .env.example, D9). This file
// is a global script (no imports/exports), so declarations merge with the
// lib DOM types directly.
interface ImportMeta {
  env?: {
    PUBLIC_BFF_URL?: string
    [key: string]: unknown
  }
}
