// Reactive wrapper around `categoryPalette` (src/lib/category-palette).
//
// `categoryPalette` is a pure function of (key, slot, palette); this hook
// subscribes to the active-palette store, resolves the active palette, and
// passes it in — so the consumer re-colors live when the palette changes.
//
// We resolve the palette from `$activePaletteId` directly (rather than via the
// `getActivePalette` helper) so the read uses exactly the same store instance
// the setter/render subscribe to — important under test bundlers that can
// otherwise duplicate the store module.

import { useStore } from "@nanostores/react"
import {
  categoryPalette,
  type ItemPalette,
  type ItemPaletteSlot,
} from "@/lib/category-palette"
import { getPalette, PALETTE_POOL, type Palette } from "@/lib/palettes"
import { getCategory } from "@/stores/categories"
import { $activePaletteId } from "@/stores/palette"

export function useCategoryPalette(
  key: string,
  overrideSlot?: ItemPaletteSlot
): ItemPalette {
  // Subscribe so the component re-renders when the active palette changes.
  useStore($activePaletteId)
  const palette: Palette =
    getPalette($activePaletteId.get()) ?? PALETTE_POOL.palettes[0]
  // Prefer the category's stored sequential slot (distinct within the palette);
  // fall back to the key-derived hash only for ad-hoc keys (e.g. palette
  // preview names) that aren't real categories.
  const slot = overrideSlot ?? getCategory(key)?.color
  return categoryPalette(key, slot, palette)
}
