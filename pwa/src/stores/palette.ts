// Active categorical palette selection (Phase 3, sub-phase 3).
//
// The pool itself lives in `src/lib/palettes`; this module only tracks which
// palette id the user has chosen as the active one. It defaults to the seed
// default and persists across reloads and reseeds (same policy as the theme
// store). `categoryPalette` reads the active palette here so every category and
// item recolor when the choice changes.

import {
  DEFAULT_PALETTE_ID,
  getPalette,
  PALETTE_POOL,
  type Palette,
} from "@/lib/palettes"
import { jsonStore, STORAGE_KEYS } from "./persistence"

const $activePaletteId = jsonStore<string>(
  STORAGE_KEYS.activePalette,
  DEFAULT_PALETTE_ID
)

// One-time startup reset: if a persisted id no longer exists in the pool (e.g. a
// palette was removed upstream), reset to the seed default so coloring never
// breaks. Called once from `initStores()` — deliberately NOT on import, so the
// barrel stays side-effect-free.
export function initActivePalette(): void {
  if (!getPalette($activePaletteId.get())) {
    $activePaletteId.set(DEFAULT_PALETTE_ID)
  }
}

/** The chosen palette id, guaranteed to resolve to a real palette. */
export function getActivePaletteId(): string {
  const id = $activePaletteId.get()
  return getPalette(id) ? id : DEFAULT_PALETTE_ID
}

/** The resolved active palette. */
export function getActivePalette(): Palette {
  return getPalette(getActivePaletteId()) ?? PALETTE_POOL.palettes[0]
}

/** Persist a new active palette; ignored unless it is a known pool id. */
export function setActivePalette(id: string): void {
  if (getPalette(id)) $activePaletteId.set(id)
}

export { $activePaletteId }
