/**
 * Generate all PWA favicon assets using the `favicons` library.
 *
 * Design notes:
 * - The brand source of truth is `@remindit/common` (`BRAND_LOGO_SVG` /
 *   `BRAND_LOGO_MASKABLE_SVG`): the normal icon for standard icons, and the
 *   maskable-safe variant which keeps the artwork inside the safe zone with a
 *   full-bleed opaque background. This script also rewrites the served copies
 *   in public/ from those constants on every run, so they can never drift.
 * - `manifestMaskable` makes favicons emit a second set of android-chrome PNGs
 *   (purpose "maskable") alongside the standard set (purpose "any").
 * - We intentionally DO NOT emit favicons' own manifest.webmanifest: rsbuild-plugin-pwa
 *   generates dist/manifest.webmanifest from rsbuild.config.ts. If we also wrote one
 *   into public/ it would be copied verbatim to dist/ and conflict with the
 *   plugin-generated manifest. So we filter the manifest.webmanifest out of `files`.
 * - The generated PNGs (and browserconfig.xml / yandex manifest) are written into
 *   public/; rsbuild copies public/* to the dist root, so they become available at
 *   `/<name>`.
 * - The `html` array contains <link>/<meta> tags (minus the manifest link) which we
 *   print so they can be pasted into public/index.html.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  BRAND_BACKGROUND_COLOR,
  BRAND_COLOR,
  BRAND_LOGO_MASKABLE_SVG,
  BRAND_LOGO_SVG,
  BRAND_NAME,
} from "@remindit/common"
import favicons from "favicons"

const PUBLIC_DIR = "public"
// Brand copies served as static assets (favicon link + manifest icons).
const NORMAL_COPY = join(PUBLIC_DIR, "remindit-icon.svg")
const MASKABLE_COPY = join(PUBLIC_DIR, "remindit-icon-maskable.svg")

const configuration = {
  path: "/", // base path used in the generated html tags / manifest references
  appName: BRAND_NAME,
  appShortName: BRAND_NAME,
  appDescription: "Local-first reminders that work offline.",
  theme_color: BRAND_COLOR,
  background: BRAND_BACKGROUND_COLOR,
  // Only run the platforms we actually need. android produces the 18 PNGs we put in
  // the web manifest; appleIcon/windows/yandex produce icons referenced from HTML.
  icons: {
    android: true,
    appleIcon: true,
    appleStartup: false,
    favicons: true,
    windows: true,
    yandex: true,
  },
  // Generate image files + html tags; files include manifest.webmanifest (skipped)
  // and browserconfig.xml / yandex-browser-manifest.json (kept).
  output: { images: true, files: true, html: true },
  // Use the maskable-safe master for the maskable icon set.
  manifestMaskable: Buffer.from(BRAND_LOGO_MASKABLE_SVG),
  // Avoid favicons trying to load an external manifest.
  loadManifestWithCredentials: false,
} as const

async function main() {
  // Sync the served brand copies from the common-module source first, so the
  // favicons run always starts from canonical artwork.
  await writeFile(NORMAL_COPY, BRAND_LOGO_SVG)
  await writeFile(MASKABLE_COPY, BRAND_LOGO_MASKABLE_SVG)
  console.log(`synced brand copies: ${NORMAL_COPY}, ${MASKABLE_COPY}`)

  const { images, files, html } = await favicons(
    Buffer.from(BRAND_LOGO_SVG),
    configuration
  )

  await mkdir(PUBLIC_DIR, { recursive: true })

  // Write all generated raster images into public/.
  for (const image of images) {
    const out = join(PUBLIC_DIR, image.name)
    await writeFile(out, image.contents)
    console.log(`wrote image: ${out} (${image.contents.byteLength} bytes)`)
  }

  // Write files, but skip favicons' own manifest.webmanifest (rsbuild owns that).
  for (const file of files) {
    if (file.name === "manifest.webmanifest") {
      console.log(`skipped file (rsbuild owns it): ${file.name}`)
      continue
    }
    const out = join(PUBLIC_DIR, file.name)
    await writeFile(out, file.contents)
    console.log(`wrote file: ${out}`)
  }

  // Print the <link>/<meta> tags, dropping any manifest link so we don't double-declare.
  const tags = html.filter((tag) => !/rel=["']manifest["']/.test(tag))
  console.log(
    "\n--- FAVICON HTML TAGS (paste into public/index.html <head>) ---"
  )
  for (const tag of tags) {
    console.log(tag)
  }
  console.log("--- END FAVICON HTML TAGS ---")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
