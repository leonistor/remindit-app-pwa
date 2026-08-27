import { UNCATEGORIZED_NAME } from "@/stores/types"

// Single source of truth for the *categorical* color language of items and
// categories. This is deliberately distinct from `RECOMMENDATION_TIERS`:
// recommendation tiers are a semantic concern (overdue/soon/frequent) and keep
// their own color tokens, whereas this palette is the qualitative identity of
// a category (so a "Dairy" category is always, say, blue).
//
// The palette is qualitative and colorblind-safe (Okabe–Ito derived hues).
// Assignment is deterministic from the category key (id *or* name) today, which
// means no store change is required. The `overrideSlot` seam lets a future
// user-assigned `Category.color` slot in without touching any consumer.
//
// Class strings are written as complete literals (no template interpolation) so
// Tailwind's content scanner can statically detect every token.

export type ItemPaletteSlot = number

export interface ItemPalette {
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
}

// Neutral slot for the uncategorized sentinel — uses existing design tokens
// rather than a hue, so it reads as "no category".
const NEUTRAL: ItemPalette = {
  button: "bg-muted text-foreground border border-input",
  buttonSelected:
    "bg-accent text-accent-foreground border border-input ring-2 ring-ring/40",
  badge: "bg-muted text-muted-foreground border border-input",
  border: "border-input",
  ring: "ring-ring/40",
  dot: "bg-muted-foreground",
}

// Seven qualitative hues (Okabe–Ito inspired). Order matters only for
// assignment stability — do not reorder existing entries.
const PALETTE_SLOTS: ItemPalette[] = [
  {
    button:
      "bg-orange-500/15 text-orange-700 border border-orange-500/30 dark:bg-orange-400/20 dark:text-orange-300 dark:border-orange-400/40",
    buttonSelected:
      "bg-orange-500/25 text-orange-800 border border-orange-500/40 ring-2 ring-orange-500/40 dark:bg-orange-400/25 dark:text-orange-200 dark:border-orange-400/50 dark:ring-orange-400/50",
    badge:
      "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-300",
    border: "border-orange-500/30 dark:border-orange-400/40",
    ring: "ring-orange-500/40 dark:ring-orange-400/50",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  {
    button:
      "bg-sky-500/15 text-sky-700 border border-sky-500/30 dark:bg-sky-400/20 dark:text-sky-300 dark:border-sky-400/40",
    buttonSelected:
      "bg-sky-500/25 text-sky-800 border border-sky-500/40 ring-2 ring-sky-500/40 dark:bg-sky-400/25 dark:text-sky-200 dark:border-sky-400/50 dark:ring-sky-400/50",
    badge:
      "bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300",
    border: "border-sky-500/30 dark:border-sky-400/40",
    ring: "ring-sky-500/40 dark:ring-sky-400/50",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  {
    button:
      "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-400/20 dark:text-emerald-300 dark:border-emerald-400/40",
    buttonSelected:
      "bg-emerald-500/25 text-emerald-800 border border-emerald-500/40 ring-2 ring-emerald-500/40 dark:bg-emerald-400/25 dark:text-emerald-200 dark:border-emerald-400/50 dark:ring-emerald-400/50",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300",
    border: "border-emerald-500/30 dark:border-emerald-400/40",
    ring: "ring-emerald-500/40 dark:ring-emerald-400/50",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    button:
      "bg-yellow-500/15 text-yellow-700 border border-yellow-500/30 dark:bg-yellow-400/20 dark:text-yellow-300 dark:border-yellow-400/40",
    buttonSelected:
      "bg-yellow-500/25 text-yellow-800 border border-yellow-500/40 ring-2 ring-yellow-500/40 dark:bg-yellow-400/25 dark:text-yellow-200 dark:border-yellow-400/50 dark:ring-yellow-400/50",
    badge:
      "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-300",
    border: "border-yellow-500/30 dark:border-yellow-400/40",
    ring: "ring-yellow-500/40 dark:ring-yellow-400/50",
    dot: "bg-yellow-500 dark:bg-yellow-400",
  },
  {
    button:
      "bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:bg-blue-400/20 dark:text-blue-300 dark:border-blue-400/40",
    buttonSelected:
      "bg-blue-500/25 text-blue-800 border border-blue-500/40 ring-2 ring-blue-500/40 dark:bg-blue-400/25 dark:text-blue-200 dark:border-blue-400/50 dark:ring-blue-400/50",
    badge:
      "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300",
    border: "border-blue-500/30 dark:border-blue-400/40",
    ring: "ring-blue-500/40 dark:ring-blue-400/50",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  {
    button:
      "bg-red-500/15 text-red-700 border border-red-500/30 dark:bg-red-400/20 dark:text-red-300 dark:border-red-400/40",
    buttonSelected:
      "bg-red-500/25 text-red-800 border border-red-500/40 ring-2 ring-red-500/40 dark:bg-red-400/25 dark:text-red-200 dark:border-red-400/50 dark:ring-red-400/50",
    badge: "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-300",
    border: "border-red-500/30 dark:border-red-400/40",
    ring: "ring-red-500/40 dark:ring-red-400/50",
    dot: "bg-red-500 dark:bg-red-400",
  },
  {
    button:
      "bg-fuchsia-500/15 text-fuchsia-700 border border-fuchsia-500/30 dark:bg-fuchsia-400/20 dark:text-fuchsia-300 dark:border-fuchsia-400/40",
    buttonSelected:
      "bg-fuchsia-500/25 text-fuchsia-800 border border-fuchsia-500/40 ring-2 ring-fuchsia-500/40 dark:bg-fuchsia-400/25 dark:text-fuchsia-200 dark:border-fuchsia-400/50 dark:ring-fuchsia-400/50",
    badge:
      "bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300",
    border: "border-fuchsia-500/30 dark:border-fuchsia-400/40",
    ring: "ring-fuchsia-500/40 dark:ring-fuchsia-400/50",
    dot: "bg-fuchsia-500 dark:bg-fuchsia-400",
  },
]

export const PALETTE_SLOT_COUNT = PALETTE_SLOTS.length

// Stable string hash (djb2) → slot index. Deterministic per key so a category
// keeps its color across reloads and across components.
function paletteSlotFor(key: string): number {
  let hash = 5381
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i)
  }
  return Math.abs(hash) % PALETTE_SLOT_COUNT
}

/**
 * Resolve the categorical palette for a category.
 *
 * @param key - Category id *or* name; any stable string works as the seed.
 * @param overrideSlot - Optional explicit slot (e.g. a future user-assigned
 *   `Category.color`). When omitted, the color is derived deterministically.
 */
export function categoryPalette(
  key: string,
  overrideSlot?: ItemPaletteSlot
): ItemPalette {
  if (key.trim().toLowerCase() === UNCATEGORIZED_NAME.toLowerCase() || key.trim() === "") {
    return NEUTRAL
  }
  const slot =
    overrideSlot !== undefined
      ? ((overrideSlot % PALETTE_SLOT_COUNT) + PALETTE_SLOT_COUNT) %
        PALETTE_SLOT_COUNT
      : paletteSlotFor(key)
  return PALETTE_SLOTS[slot]
}

/** Plain list of palettes, e.g. for building a future color-picker UI. */
export const ALL_PALETTES = PALETTE_SLOTS
