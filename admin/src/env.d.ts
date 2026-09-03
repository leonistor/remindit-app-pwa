/**
 * Ambient declarations for the admin module (mirrors web/src/env.d.ts):
 * `*.svg?raw` (brand via @remindit/common) + `*.css` side-effect imports.
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}

declare module "*.css"
