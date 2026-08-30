// Invariants for the categorical palette pool (seed/palettes.json) loaded via
// src/lib/palettes. Guards the contract later phases (color picker, palette
// chooser) depend on: exactly 5 palettes, a valid default, and every palette
// having 12 distinct, well-formed colors.

import { describe, expect, test } from "@rstest/core"
import {
  assignSequentialColor,
  DEFAULT_PALETTE_ID,
  defaultPalette,
  getPalette,
  PALETTE_POOL,
} from "@/lib/palettes"

const HEX_RE = /^#[0-9a-f]{6}$/

describe("palette pool", () => {
  test("has exactly five palettes", () => {
    expect(PALETTE_POOL.palettes).toHaveLength(5)
  })

  test("points defaultPaletteId at an existing palette", () => {
    expect(getPalette(DEFAULT_PALETTE_ID)).toBeDefined()
    expect(defaultPalette.id).toBe(DEFAULT_PALETTE_ID)
  })

  test("gives every palette exactly 12 colors that are valid, distinct, and named", () => {
    for (const palette of PALETTE_POOL.palettes) {
      expect(palette.colors).toHaveLength(12)
      const hexes = new Set<string>()
      for (const color of palette.colors) {
        expect(color.hex).toMatch(HEX_RE)
        expect(color.name.length).toBeGreaterThan(0)
        expect(hexes.has(color.hex)).toBe(false)
        hexes.add(color.hex)
      }
      // The default palette must itself be 12-wide for sequential assignment.
    }
  })

  test("keeps the d3 anchor colors for schemes that were already 12 long", () => {
    expect(getPalette("paired")?.colors[0].hex).toBe("#a6cee3")
    expect(getPalette("paired")?.colors[11].hex).toBe("#b15928")
    expect(getPalette("set3")?.colors[0].hex).toBe("#8dd3c7")
    expect(getPalette("set3")?.colors[11].hex).toBe("#ffed6f")
  })

  test("assigns colors sequentially and wraps at the palette length", () => {
    expect(assignSequentialColor(0)).toBe(defaultPalette.colors[0].hex)
    expect(assignSequentialColor(12)).toBe(defaultPalette.colors[0].hex)
    expect(assignSequentialColor(1)).toBe(defaultPalette.colors[1].hex)
    // Negative indices wrap too.
    expect(assignSequentialColor(-1)).toBe(
      defaultPalette.colors[defaultPalette.colors.length - 1].hex
    )
  })

  test("exposes a description sourced from the d3 scheme", () => {
    for (const palette of PALETTE_POOL.palettes) {
      expect(palette.description).toMatch(/^Based on d3 scheme/)
    }
  })
})
