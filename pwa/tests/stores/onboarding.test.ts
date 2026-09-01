// Verifies `completeOnboarding()` (src/stores/index.ts): the single action that
// finalizes the onboarding flow — persists the profile + chosen dataset, seeds
// the catalog/categories from that dataset with a first-run history, and flips
// the persisted onboarded gate. Also guards the W4 invariant: once onboarded,
// `initStores()` must never re-seed or resurrect emptied data.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { getDataset } from "seed"
import {
  $onboarded,
  completeOnboarding,
  initStores,
  isOnboarded,
  setOnboarded,
} from "@/stores"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { STORAGE_KEYS } from "@/stores/persistence"
import type { UserProfile } from "@/stores/types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "@/stores/types"
import { $user } from "@/stores/user"
import { resetStores } from "../fixtures/reset"

// Deterministic stand-in for the async DiceBear profile the Onboarding view
// generates; shape must match UserProfile exactly.
const PROFILE: UserProfile = {
  username: "calm-otter",
  firstName: "Calm",
  lastName: "Otter",
  email: "",
  avatar: "data:image/svg+xml,fake",
}

describe("completeOnboarding", () => {
  // resetStores clears every data store + localStorage, but the onboarding
  // flags live in their own persistent atoms — flip them explicitly so each
  // test starts from a genuine "never onboarded" slate.
  beforeEach(() => {
    resetStores()
    setOnboarded(false)
  })

  test("before onboarding: flag false (in memory and persisted) and stores empty", () => {
    expect($onboarded.get()).toBe(false)
    expect(isOnboarded()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.onboarded)).toBe("false")
    expect($catalog.get()).toEqual([])
    expect($categories.get()).toEqual([])
    expect($list.get()).toEqual([])
    expect($history.get()).toEqual([])
    expect($user.get().username).toBe("")
  })

  test("persists the profile + dataset, seeds minimal catalog/categories + history, flips the flag", () => {
    completeOnboarding(PROFILE, "minimal")

    // Flag is flipped in memory AND persisted JSON-encoded ("true").
    expect($onboarded.get()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.onboarded)).toBe("true")

    // Profile stored verbatim; dataset choice persisted for later runs/resets.
    expect($user.get()).toEqual(PROFILE)
    expect(localStorage.getItem(STORAGE_KEYS.selectedDataset)).toBe(
      JSON.stringify("minimal")
    )

    // Catalog/categories seeded from the chosen dataset: catalog verbatim,
    // categories prefixed with the uncategorized sentinel and assigned
    // sequential palette slots (0-based, dataset order) — same shape the
    // seedFromDataset tests pin down.
    const { categories, catalog } = getDataset("minimal")
    expect($catalog.get()).toEqual(catalog)
    expect($categories.get()).toEqual([
      { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, frequency: "unknown" },
      ...categories.map((c, i) => ({ ...c, color: i })),
    ])

    // First-run history seeded (PUBLIC_SEED_HISTORY defaults on) so the
    // recommender has data immediately after onboarding.
    expect($history.get().length).toBeGreaterThan(0)
    for (const e of $history.get()) {
      expect(e.action === "add" || e.action === "remove").toBe(true)
      expect(typeof e.itemId).toBe("string")
      expect(e.itemId.length).toBeGreaterThan(0)
    }
  })

  test("initStores afterwards neither re-seeds nor overwrites the onboarded state", () => {
    completeOnboarding(PROFILE, "minimal")
    const catalog = $catalog.get()
    const categories = $categories.get()
    const history = $history.get()
    expect(catalog.length).toBeGreaterThan(0)

    // Re-running the bootstrap is a no-op once onboarded: the persisted
    // catalog record exists, so the first-run seed guard never fires.
    initStores()
    expect($catalog.get()).toEqual(catalog)
    expect($categories.get()).toEqual(categories)
    expect($history.get()).toEqual(history)
    expect($user.get()).toEqual(PROFILE)

    // Stronger W4 check: a user who deletes EVERYTHING (explicit empty
    // records persisted) still gets nothing resurrected by a reload.
    $catalog.set([])
    $list.set([])
    $history.set([])
    initStores()
    expect($catalog.get()).toEqual([])
    expect($list.get()).toEqual([])
    expect($history.get()).toEqual([])
  })
})
