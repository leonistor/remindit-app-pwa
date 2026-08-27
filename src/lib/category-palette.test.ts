// Unit tests for the categorical palette (src/lib/category-palette).
//
// The palette is the qualitative color identity of categories/items and must
// be deterministic (stable across reloads), return neutral for uncategorized,
// and honor an explicit override slot (the future user-assigned color seam).

import { describe, expect, it } from "@rstest/core"
import {
  ALL_PALETTES,
  categoryPalette,
  PALETTE_SLOT_COUNT,
} from "@/lib/category-palette"

describe("categoryPalette", () => {
  it("is deterministic for the same key", () => {
    expect(categoryPalette("dairy")).toBe(categoryPalette("dairy"))
    expect(categoryPalette("Produce")).toBe(categoryPalette("produce"))
  })

  it("returns a distinct palette per slot and never throws for arbitrary keys", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const key = `category-${i}`
      const palette = categoryPalette(key)
      expect(palette.button).toContain("border")
      seen.add(palette.button)
    }
    // Not every slot is guaranteed to appear, but assignment should spread.
    expect(seen.size).toBeGreaterThan(1)
  })

  it("returns neutral for uncategorized / empty keys", () => {
    expect(categoryPalette("Uncategorized").button).toBe(
      categoryPalette("uncategorized").button
    )
    expect(categoryPalette("  ").button).toContain("bg-muted")
    expect(categoryPalette("").button).toContain("bg-muted")
  })

  it("honors an explicit override slot and wraps out-of-range values", () => {
    const slotZero = ALL_PALETTES[0].button
    expect(categoryPalette("dairy", 0).button).toBe(slotZero)
    expect(categoryPalette("dairy", PALETTE_SLOT_COUNT).button).toBe(slotZero)
    expect(categoryPalette("dairy", -1).button).toBe(
      ALL_PALETTES[PALETTE_SLOT_COUNT - 1].button
    )
  })

  it("exposes a fixed number of palettes", () => {
    expect(PALETTE_SLOT_COUNT).toBe(ALL_PALETTES.length)
  })
})
