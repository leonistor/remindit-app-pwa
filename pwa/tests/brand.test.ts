// Drift guard for the brand icon assets.
//
// `@remindit/common` owns the logo SVGs (../common/assets/) and
// scripts/generate-favicons.ts rewrites the served copies in public/ from them
// on every run. If these assertions fail, public/remindit-icon*.svg was edited
// directly — revert it and edit common/assets/ instead (see pwa/DESIGN.md).

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { BRAND_LOGO_MASKABLE_SVG, BRAND_LOGO_SVG } from "@remindit/common/brand"
import { describe, expect, test } from "@rstest/core"

const readPublicCopy = (name: string) =>
  readFileSync(join(__dirname, "..", "public", name), "utf8")

describe("brand asset drift guard", () => {
  test("served icon matches the @remindit/common asset", () => {
    expect(BRAND_LOGO_SVG).toBe(readPublicCopy("remindit-icon.svg"))
  })

  test("served maskable icon matches the @remindit/common asset", () => {
    expect(BRAND_LOGO_MASKABLE_SVG).toBe(
      readPublicCopy("remindit-icon-maskable.svg")
    )
  })
})
