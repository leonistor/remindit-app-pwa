// Verifies that `initStores()` triggers first-run seeding, including the
// generated 6-month shopping history (not just catalog/categories), and that
// it never re-seeds an onboarded user's emptied data.

import { expect, test } from "@rstest/core"
import { initStores, setOnboarded } from "@/stores"
import { $catalog } from "@/stores/catalog"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"

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

test("initStores does not re-seed an onboarded user who emptied their data", () => {
  setOnboarded(true)
  // Reset only the data stores: each `.set([])` persists an explicit empty
  // record, mimicking a user who deleted everything. (resetStores() would
  // localStorage.clear() and erase the records, making this look like a fresh
  // install instead.)
  $catalog.set([])
  $list.set([])
  $history.set([])
  initStores()
  // User data is authoritative — nothing is resurrected.
  expect($catalog.get()).toEqual([])
  expect($list.get()).toEqual([])
  expect($history.get()).toEqual([])
})
