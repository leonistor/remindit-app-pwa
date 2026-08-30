// Unit tests for the categories store (src/stores/categories).
//
// We import the submodules directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.

import { beforeEach, describe, expect, test } from "@rstest/core"
import {
  $categories,
  addCategory,
  renameCategory,
} from "@/stores/categories"
import type { CategoryFrequency } from "@/stores/types"
import { UNCATEGORIZED_ID } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

describe("categories store", () => {
  beforeEach(resetStores)

  test("addCategory appends a category with a generated id and the given name", () => {
    const category = addCategory("Produce")

    const categories = $categories.get()
    expect(categories).toHaveLength(1)
    expect(categories[0]).toBe(category)
    expect(category.name).toBe("Produce")
    expect(typeof category.id).toBe("string")
    expect(category.id.length).toBeGreaterThan(0)
  })

  test("addCategory defaults frequency to 'unknown' when omitted", () => {
    const category = addCategory("Produce")
    expect(category.frequency).toBe("unknown")
  })

  test.each<CategoryFrequency>([
    "daily",
    "every-2-3-days",
    "weekly",
    "every-2-weeks",
    "monthly",
    "every-3-months",
    "seldom",
    "unknown",
  ])("addCategory honors an explicit frequency '%s'", (frequency) => {
    const category = addCategory("Produce", frequency)
    expect(category.frequency).toBe(frequency)
  })

  test("renameCategory updates the category name", () => {
    const category = addCategory("Produce")
    renameCategory(category.id, "Vegetables")

    const updated = $categories.get().find((c) => c.id === category.id)
    expect(updated?.name).toBe("Vegetables")
  })

  test("renameCategory is a no-op for UNCATEGORIZED_ID", () => {
    // Seed the sentinel so the no-op is observable.
    $categories.set([
      { id: UNCATEGORIZED_ID, name: "Uncategorized", frequency: "unknown" },
    ])

    renameCategory(UNCATEGORIZED_ID, "Renamed")

    const sentinel = $categories.get().find((c) => c.id === UNCATEGORIZED_ID)
    expect(sentinel?.name).toBe("Uncategorized")
  })

})
