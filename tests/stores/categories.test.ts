// Unit tests for the categories store (src/stores/categories).
//
// We import the submodules directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.

import { describe, expect, test, beforeEach } from "@rstest/core"
import {
  $categories,
  addCategory,
  renameCategory,
  removeCategory,
} from "@/stores/categories"
import { $catalog, addCatalogItem } from "@/stores/catalog"
import { $history } from "@/stores/history"
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

  test("renameCategory updates the category name", () => {
    const category = addCategory("Produce")
    renameCategory(category.id, "Vegetables")

    const updated = $categories.get().find((c) => c.id === category.id)
    expect(updated?.name).toBe("Vegetables")
  })

  test("renameCategory is a no-op for UNCATEGORIZED_ID", () => {
    // Seed the sentinel so the no-op is observable.
    $categories.set([{ id: UNCATEGORIZED_ID, name: "Uncategorized" }])

    renameCategory(UNCATEGORIZED_ID, "Renamed")

    const sentinel = $categories.get().find((c) => c.id === UNCATEGORIZED_ID)
    expect(sentinel?.name).toBe("Uncategorized")
  })

  test("removeCategory reassigns catalog items to UNCATEGORIZED and drops the category (no history)", () => {
    const category = addCategory("Produce")
    const item = addCatalogItem("Apple", category.id)

    // Record history length before deletion so we can assert it is unchanged.
    const historyBefore = $history.get().length

    removeCategory(category.id)

    // The catalog item now points at the sentinel category.
    const updatedItem = $catalog.get().find((i) => i.id === item.id)
    expect(updatedItem?.categoryId).toBe(UNCATEGORIZED_ID)

    // The category itself is gone from the list.
    expect($categories.get().some((c) => c.id === category.id)).toBe(false)

    // Deleting a category must NOT write history.
    expect($history.get()).toHaveLength(historyBefore)
  })

  test("removing UNCATEGORIZED_ID is a no-op (sentinel stays present)", () => {
    $categories.set([
      { id: UNCATEGORIZED_ID, name: "Uncategorized" },
      { id: "cat-produce", name: "Produce" },
    ])

    removeCategory(UNCATEGORIZED_ID)

    const categories = $categories.get()
    expect(categories.some((c) => c.id === UNCATEGORIZED_ID)).toBe(true)
    // The other category is untouched.
    expect(categories.some((c) => c.id === "cat-produce")).toBe(true)
  })
})
