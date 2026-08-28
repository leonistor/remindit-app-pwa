// Verifies the runtime reset + reseed path (`seedFromDataset`) used by the
// Settings "Reset app & reseed" action. Unlike `initStores` (first-run, guarded
// on empty stores), this always overwrites and takes the dataset id explicitly.

import { beforeAll, expect, test } from "@rstest/core"
import { DEFAULT_DATASET_ID, getDataset } from "seed"
import {
  $catalog,
  $categories,
  $history,
  $list,
  $user,
  initStores,
  seedFromDataset,
  setOnboarded,
} from "@/stores"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "@/stores/types"

const THEME_KEY = "remindit:theme"

// Seed the default dataset once, mirroring the real app entry point, so the
// reseed tests start from a populated store. `initStores` only seeds once the
// user is onboarded, so flip that flag first.
beforeAll(() => {
  setOnboarded(true)
  initStores()
})

test("seedFromDataset overwrites the catalog/categories with the chosen dataset", () => {
  expect($catalog.get().length).toBeGreaterThan(0)

  const { categories, catalog } = getDataset("rick_morty")
  seedFromDataset("rick_morty")

  // Catalog is replaced wholesale, not merged.
  expect($catalog.get()).toEqual(catalog)
  // Categories include the uncategorized sentinel plus the dataset's categories.
  expect($categories.get()).toEqual([
    { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, frequency: "unknown" },
    ...categories,
  ])
})

test("seedFromDataset wipes user data but keeps the theme preference", () => {
  localStorage.setItem(THEME_KEY, "dark")

  // Simulate a populated user list/history before reset.
  $list.set([{ id: "x", itemId: "y", checked: false, addedAt: 1 }])
  expect($list.get().length).toBeGreaterThan(0)

  seedFromDataset("leo_romanian")

  // User-generated state is cleared / regenerated.
  expect($list.get()).toEqual([])
  expect($history.get().length).toBeGreaterThan(0) // fresh generated history
  expect($user.get().username).toBeTruthy() // regenerated random profile

  // Theme preference is deliberately preserved across a reset.
  expect(localStorage.getItem(THEME_KEY)).toBe("dark")
})

test("seedFromDataset falls back to the default dataset for an unknown id", () => {
  seedFromDataset("does-not-exist")
  const { catalog } = getDataset(DEFAULT_DATASET_ID)
  expect($catalog.get()).toEqual(catalog)
})
