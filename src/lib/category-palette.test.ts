// Unit tests for the categorical palette (src/lib/category-palette).
//
// The palette is now backed by the pool in seed/palettes.json: it turns a
// category key into DOM tokens built from inline `--cat` / `--cat-ink` CSS
// vars. It must stay deterministic (stable across reloads), return neutral for
// uncategorized, resolve real hexes from the default palette, and honor an
// explicit override slot (the future user-assigned color seam).

import { describe, expect, it } from "@rstest/core"
import { categoryPalette, PALETTE_SLOT_COUNT } from "@/lib/category-palette"
import { defaultPalette } from "@/lib/palettes"

describe("categoryPalette", () => {
  it("is deterministic for the same key", () => {
    expect(categoryPalette("dairy").hex).toBe(categoryPalette("dairy").hex)
    expect(categoryPalette("Produce").hex).toBe(categoryPalette("produce").hex)
  })

  it("returns a neutral, var-free palette for uncategorized / empty keys", () => {
    const neutral = categoryPalette("Uncategorized")
    expect(neutral.hex).toBe("")
    expect(neutral.button).toContain("bg-muted")
    expect(neutral.style).toEqual({})
    expect(categoryPalette("  ").button).toContain("bg-muted")
    expect(categoryPalette("").button).toContain("bg-muted")
  })

  it("resolves a real hex from the default palette and spreads across slots", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      seen.add(categoryPalette(`category-${i}`).hex)
    }
    // Assigns from the 12-color default palette (not every slot guaranteed,
    // but it should use more than one).
    expect(seen.size).toBeGreaterThan(1)
    expect(seen.size).toBeLessThanOrEqual(PALETTE_SLOT_COUNT)
  })

  it("exposes tokens that read the --cat / --cat-ink CSS vars", () => {
    const palette = categoryPalette("dairy")
    expect(palette.button).toContain("var(--cat)")
    expect(palette.button).toContain("var(--cat-ink)")
    expect(palette.badge).toContain("var(--cat)")
    expect((palette.style as Record<string, string>)["--cat"]).toMatch(
      /^#[0-9a-f]{6}$/
    )
  })

  it("honors an explicit override slot and wraps out-of-range values", () => {
    const slotZero = defaultPalette.colors[0].hex
    expect(categoryPalette("dairy", 0).hex).toBe(slotZero)
    expect(categoryPalette("dairy", PALETTE_SLOT_COUNT).hex).toBe(slotZero)
    expect(categoryPalette("dairy", -1).hex).toBe(
      defaultPalette.colors[PALETTE_SLOT_COUNT - 1].hex
    )
  })

  it("exposes a fixed slot count matching the default palette", () => {
    expect(PALETTE_SLOT_COUNT).toBe(defaultPalette.colors.length)
    expect(PALETTE_SLOT_COUNT).toBe(12)
  })
})
