// Resets all stores (and the underlying localStorage) between tests.
//
// Usage in a sibling test file (e.g. tests/stores/*.test.ts):
//
//   import { describe, beforeEach, it, expect } from "@rstest/core"
//   import { resetStores } from "../fixtures/reset"
//   import { $history } from "@/stores/history"
//
//   describe("history store", () => {
//     beforeEach(resetStores)
//     it("starts empty", () => {
//       expect($history.get()).toEqual([])
//     })
//   })
//
// Submodules are imported directly (NOT the `@/stores` barrel) so the test
// stays decoupled from the app's bootstrap (`initStores` / `setupDevLogging`),
// which the entry point calls explicitly.
//
// Covers all 12 persisted atoms — the same set `wipeAllData()` resets and
// `LocalDataEnvelope["data"]` snapshots — using each module's own default:
//   $history, $list, $catalog, $categories, $user,
//   $theme, $activePaletteId, $selectedSort, $accordionOpen,
//   $onboarded, $selectedDatasetId, $installDismissed

import { DEFAULT_PALETTE_ID } from "@/lib/palettes"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { $onboarded, $selectedDatasetId } from "@/stores/onboarding"
import { $activePaletteId } from "@/stores/palette"
import { $installDismissed } from "@/stores/pwa-install"
import { $theme } from "@/stores/theme"
import type { UserProfile } from "@/stores/types"
import { $accordionOpen, $selectedSort } from "@/stores/ui"
import { $user } from "@/stores/user"

const DEFAULT_USER: UserProfile = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

// Resets every persisted atom to its initial value and clears the persisted
// localStorage so each test starts from a clean, deterministic first-run
// slate. Atom sets come first, `localStorage.clear()` last, so no write can
// land after the wipe.
export function resetStores(): void {
  $history.set([])
  $list.set([])
  $catalog.set([])
  $categories.set([])
  $user.set(DEFAULT_USER)
  $theme.set("system")
  $activePaletteId.set(DEFAULT_PALETTE_ID)
  $selectedSort.set("default")
  $accordionOpen.set(null)
  $onboarded.set(false)
  $selectedDatasetId.set("")
  $installDismissed.set(false)
  localStorage.clear()
}
