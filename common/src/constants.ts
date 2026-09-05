// Plain brand constants — no asset imports, safe for every consumer
// toolchain including jiti-based config loaders (Rsbuild's loadConfig under
// Node, used by the rstest adapter), which cannot resolve `?raw` asset
// imports. The logo SVGs therefore live in brand.ts, exposed via the
// `@remindit/common/brand` subpath.

/** Brand name — capital I, single word. */
export const BRAND_NAME = "RemindIt"

/** Round logo fill on white; also the PWA theme color. */
export const BRAND_COLOR = "#262626"

/** Brand background white; also the PWA background color. */
export const BRAND_BACKGROUND_COLOR = "#ffffff"

/**
 * Marketing site origin (the web module). Used by the PWA's About page to
 * point back at the website; kept here like name/colors so every module
 * links to the same canonical domain instead of hardcoding it.
 */
export const BRAND_WEBSITE_URL = "https://www.remindit.me"
