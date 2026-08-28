// Verifies that `initStores()` triggers first-run seeding, including the
// generated 6-month shopping history (not just catalog/categories).

import { expect, test } from "@rstest/core"
import { initStores, setOnboarded } from "@/stores"
import { $catalog } from "@/stores/catalog"
import { $history } from "@/stores/history"

test("initStores seeds a non-empty catalog and a generated history on first run", () => {
  // initStores only seeds once the user is onboarded (first-run seeding is
  // deferred to the onboarding flow for non-onboarded users).
  setOnboarded(true)
  initStores()
  // Default dataset (minimal) when PUBLIC_DATASET is unset in tests.
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
