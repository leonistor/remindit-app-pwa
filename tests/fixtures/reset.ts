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
// Submodules are imported directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.

import type { User } from "@/stores/types"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { $user } from "@/stores/user"

const DEFAULT_USER: User = { name: "", photo: "" }

// Clears every store and the persisted localStorage so each test starts from a
// clean, deterministic slate.
export function resetStores(): void {
  $history.set([])
  $list.set([])
  $catalog.set([])
  $categories.set([])
  $user.set(DEFAULT_USER)
  localStorage.clear()
}
