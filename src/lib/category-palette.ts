import type { CSSProperties } from "react"
import { UNCATEGORIZED_NAME } from "@/stores/types"
import { defaultPalette } from "@/lib/palettes"

// Categorical color language for items and categories, now backed by the
// palette *pool* in `seed/palettes.json` (see `src/lib/palettes`). This module
// is the single place that turns a category key into a set of DOM tokens.
//
// Because pool colors are arbitrary hex (not fixed Tailwind hues), we can't emit
// static `bg-orange-500` classes — Tailwind's scanner wouldn't see them.
// Instead every token is a *static* class that reads two CSS variables set
// inline per element: `--cat` (the solid palette hue, used as the full
// background) and `--cat-ink` (a precomputed near-black/white text color chosen
// for WCAG contrast). The background is the same full color in light and dark
// themes, so a single contrast ink stays accessible in both.
//
// Color identity is deterministic from the category key (hash → slot) so a
// category keeps its color across reloads and across components. The
// `overrideSlot` seam lets a future user-assigned `Category.color` slot in
// without touching any consumer: the store will pass the explicit palette index
// it assigned sequentially at dataset init.

export type ItemPaletteSlot = number

export interface ItemPalette {
  /** Inline style exposing the color as CSS vars (`--cat`, `--cat-ink`). */
  style: CSSProperties
  /** Resting tint for an item/category chip. */
  button: string
  /** Emphasized tint (selected / in-list). Includes a colored ring. */
  buttonSelected: string
  /** Tint for a small category label badge. */
  badge: string
  /** Border color token. */
  border: string
  /** Ring color token (used for emphasis). */
  ring: string
  /** Solid dot/pip color (category markers). */
  dot: string
  /** Resolved solid hex (non-DOM use, e.g. legends). */
  hex: string
}

// Number of colors in the active palette. Assignment wraps modulo this.
export const PALETTE_SLOT_COUNT = defaultPalette.colors.length

// Neutral slot for the uncategorized sentinel — uses existing design tokens
// rather than a hue, so it reads as "no category". No CSS vars are set, and no
// border (consistent with the pool-backed slots).
const NEUTRAL: ItemPalette = {
  style: {},
  button: "bg-muted text-foreground",
  buttonSelected: "bg-accent text-accent-foreground",
  badge: "bg-muted text-muted-foreground",
  border: "",
  ring: "",
  dot: "bg-muted-foreground",
  hex: "",
}

// WCAG relative luminance of a hex (sRGB, linearized).
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  const num = m ? parseInt(m[1], 16) : 0
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = channel((num >> 16) & 255)
  const g = channel((num >> 8) & 255)
  const b = channel(num & 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Pick the readable ink (near-black or white) for a full-strength background,
// using the higher WCAG contrast ratio. Because the background is the solid
// palette hue in *both* light and dark modes, the same ink stays accessible in
// either theme.
function contrastInk(hex: string): string {
  const l = relativeLuminance(hex)
  const contrastWhite = (1.0 + 0.05) / (l + 0.05)
  const contrastBlack = (l + 0.05) / 0.05
  return contrastWhite >= contrastBlack ? "#ffffff" : "#0a0a0a"
}

// Build the token set for a single hex. The class strings are written as
// complete literals (no interpolation) so Tailwind's content scanner detects
// every token; the hue itself comes from the inline `--cat` / `--cat-ink` vars.
// The background is the *full* palette color with no border, and the text color
// (`--cat-ink`) is precomputed for accessible contrast.
function paletteForHex(hex: string): ItemPalette {
  const ink = contrastInk(hex)
  const style = { "--cat": hex, "--cat-ink": ink } as CSSProperties
  return {
    style,
    hex,
    button: "bg-[var(--cat)] text-[color:var(--cat-ink)]",
    buttonSelected: "bg-[var(--cat)] text-[color:var(--cat-ink)]",
    badge: "bg-[var(--cat)] text-[color:var(--cat-ink)]",
    border: "",
    ring: "",
    dot: "bg-[var(--cat)]",
  }
}

// Stable string hash (djb2) → slot index. Deterministic per key so a category
// keeps its color across reloads and across components until an explicit
// override is supplied. The key is lowercased first so casing differences
// ("Produce" vs "produce") resolve to the same color.
function paletteSlotFor(key: string): number {
  const norm = key.toLowerCase()
  let hash = 5381
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 33) ^ norm.charCodeAt(i)
  }
  return Math.abs(hash) % PALETTE_SLOT_COUNT
}

/**
 * Resolve the categorical palette for a category.
 *
 * @param key - Category id *or* name; any stable string works as the seed.
 * @param overrideSlot - Optional explicit palette index (e.g. a future
 *   user-assigned `Category.color`, or the index a dataset assigned
 *   sequentially at init). When omitted, the color is derived deterministically
 *   from `key`.
 */
export function categoryPalette(
  key: string,
  overrideSlot?: ItemPaletteSlot
): ItemPalette {
  if (
    key.trim().toLowerCase() === UNCATEGORIZED_NAME.toLowerCase() ||
    key.trim() === ""
  ) {
    return NEUTRAL
  }
  const slot =
    overrideSlot !== undefined
      ? ((overrideSlot % PALETTE_SLOT_COUNT) + PALETTE_SLOT_COUNT) %
        PALETTE_SLOT_COUNT
      : paletteSlotFor(key)
  return paletteForHex(defaultPalette.colors[slot].hex)
}

/** The active (default) palette's hex list — convenience for a future picker. */
export const ALL_PALETTE_HEXES = defaultPalette.colors.map((c) => c.hex)
