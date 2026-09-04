/**
 * Ambient module declaration for the `?raw` asset query. The bff imports
 * brand constants from `@remindit/common/brand`, whose brand.ts loads the logo
 * SVGs from common/assets/ via `?raw` — the Bun runtime resolves it natively,
 * TypeScript needs the wildcard (same declaration as web/src/env.d.ts).
 *
 * Named `raw-assets.d.ts` rather than `env.d.ts`: TypeScript excludes `env.d.ts`
 * as a possible output of the existing `src/env.ts`, so a same-named ambient
 * file would silently drop out of the program.
 */
declare module "*.svg?raw" {
  const content: string
  export default content
}
