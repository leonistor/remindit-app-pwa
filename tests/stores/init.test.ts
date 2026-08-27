// Verifies that `initStores()` triggers first-run seeding, including the
// generated 6-month shopping history (not just catalog/categories).

import { expect, test } from "@rstest/core"
import { initStores } from "@/stores"
import { $catalog } from "@/stores/catalog"
import { $history } from "@/stores/history"

test("initStores seeds a non-empty catalog and a generated history on first run", () => {
  initStores()
  // Default dataset (items_categories) when PUBLIC_DATASET is unset in tests.
  expect($catalog.get().length).toBeGreaterThan(0)
  // The frequency-aware history generator ran and produced a substantial log.
  expect($history.get().length).toBeGreaterThan(100)
  // Every event is well-formed.
  for (const e of $history.get()) {
    expect(e.action === "add" || e.action === "remove").toBe(true)
    expect(typeof e.itemId).toBe("string")
    expect(e.itemId.length).toBeGreaterThan(0)
  }
})
