// Typed access to the categorical palette pool stored in `seed/palettes.json`.
//
// This is the single source of truth for the *pool* of palettes (Phase 3).
// Category/item coloring will later be wired to consume this — today it only
// exposes the pool plus a deterministic sequential assignment used when a data
// set is first initialized (category N gets color `N % 12`). The future
// per-category color picker and the settings palette chooser will layer on top
// of `getPalette` / `defaultPalette` without touching this module's surface.

import palettesJson from "seed/palettes.json"

export interface PaletteColor {
  /** Solid hex, e.g. "#1f77b4". */
  hex: string
  /** Human-readable label derived from the hue wheel. */
  name: string
}

export interface Palette {
  id: string
  name: string
  /** Provenance, e.g. "d3 schemeCategory10". */
  source: string
  /** Where the palette came from. */
  description: string
  /** Fixed-length (12) color list. */
  colors: PaletteColor[]
}

export interface PalettePool {
  defaultPaletteId: string
  palettes: Palette[]
}

const pool = palettesJson as PalettePool

export const PALETTE_POOL: PalettePool = pool
export const DEFAULT_PALETTE_ID: string = pool.defaultPaletteId

export function getPalette(id: string): Palette | undefined {
  return pool.palettes.find((p) => p.id === id)
}

/** The default palette, guaranteed non-null (falls back to the first entry). */
export const defaultPalette: Palette =
  getPalette(DEFAULT_PALETTE_ID) ?? pool.palettes[0]

/**
 * Resolve the solid hex for a category at `index` within the default palette.
 * Assignment is sequential and wraps modulo the palette length (12).
 */
export function assignSequentialColor(index: number): string {
  return getPaletteColor(DEFAULT_PALETTE_ID, index)
}

/** Same as {@link assignSequentialColor} but for an explicit palette. */
export function getPaletteColor(paletteId: string, index: number): string {
  const palette = getPalette(paletteId) ?? defaultPalette
  const len = palette.colors.length
  const i = ((index % len) + len) % len
  return palette.colors[i].hex
}
