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
// inline per element: `--cat` (the base hue) and `--cat-ink` (a darkened variant
// for legible light-mode text). The variables give us full dynamic coloring plus
// free dark-mode variants via the `dark:` classes below.
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
// rather than a hue, so it reads as "no category". No CSS vars are set.
const NEUTRAL: ItemPalette = {
  style: {},
  button: "bg-muted text-foreground border border-input",
  buttonSelected: "bg-accent text-accent-foreground border border-input",
  badge: "bg-muted text-muted-foreground border border-input",
  border: "border-input",
  ring: "ring-ring/40",
  dot: "bg-muted-foreground",
  hex: "",
}

// Darken a hex toward black by `amount` (0..1) for legible light-mode text.
function shadeTowardBlack(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const mix = (c: number) => Math.round(c + (0 - c) * amount)
  const r = mix((num >> 16) & 255)
  const g = mix((num >> 8) & 255)
  const b = mix(num & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// Build the token set for a single hex. The class strings are written as
// complete literals (no interpolation) so Tailwind's content scanner detects
// every token; the hue itself comes from the inline `--cat` / `--cat-ink` vars.
function paletteForHex(hex: string): ItemPalette {
  const ink = shadeTowardBlack(hex, 0.45)
  const style = { "--cat": hex, "--cat-ink": ink } as CSSProperties
  return {
    style,
    hex,
    button:
      "bg-[var(--cat)]/15 text-[color:var(--cat-ink)] border border-[var(--cat)]/30 dark:bg-[var(--cat)]/20 dark:text-[color:var(--cat)] dark:border-[var(--cat)]/40",
    buttonSelected:
      "bg-[var(--cat)]/25 text-[color:var(--cat-ink)] border border-[var(--cat)]/30 dark:bg-[var(--cat)]/25 dark:text-[color:var(--cat)] dark:border-[var(--cat)]/40",
    badge:
      "bg-[var(--cat)]/15 text-[color:var(--cat-ink)] dark:bg-[var(--cat)]/20 dark:text-[color:var(--cat)]",
    border: "border-[var(--cat)]/30 dark:border-[var(--cat)]/40",
    ring: "ring-[color:var(--cat)]/40 dark:ring-[color:var(--cat)]/50",
    dot: "bg-[var(--cat)] dark:bg-[var(--cat)]",
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
