/**
 * Ambient module declarations for the web module.
 *
 * `*.svg?raw`: this module consumes brand constants from `@remindit/common`,
 * whose brand.ts imports the logo SVGs from common/assets/ via the `?raw`
 * query — Rspack resolves it (raw string), TypeScript needs the wildcard.
 * `*.css`: side-effect stylesheet imports (Rspack-native).
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}

declare module "*.css"
