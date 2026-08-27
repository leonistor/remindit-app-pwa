// Unit tests for the panel selector stores (src/stores/selectors).
//
// These computed stores derive enriched views from the raw $catalog,
// $categories and $list stores. We seed each underlying store with known values
// via `$store.set([...])` in beforeEach and assert the derived shapes +
// membership. We import the submodule directly (NOT the `@/stores` barrel) to
// avoid initStores() side effects, and we avoid `vi` (not an auto-injected
// global in this project's config).

import { beforeEach, describe, expect, it } from "@rstest/core"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $list } from "@/stores/list"
import {
  $catalogByCategory,
  $catalogView,
  $listItemIds,
  $selectedView,
} from "@/stores/selectors"
import type { CatalogItem, Category, ListEntry } from "@/stores/types"

const SEED_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Produce", frequency: "weekly" },
  { id: "cat-2", name: "Dairy", frequency: "weekly" },
]

const SEED_CATALOG: CatalogItem[] = [
  { id: "item-1", name: "Apple", categoryId: "cat-1" },
  { id: "item-2", name: "Milk", categoryId: "cat-2" },
  // Points at a category that does not exist -> "Uncategorized" fallback.
  { id: "item-3", name: "Orphan", categoryId: "missing-cat" },
]

const SEED_LIST: ListEntry[] = [
  { id: "entry-1", itemId: "item-1", checked: false, addedAt: 100 },
  { id: "entry-2", itemId: "item-2", checked: true, addedAt: 200 },
]

beforeEach(() => {
  $categories.set(SEED_CATEGORIES)
  $catalog.set(SEED_CATALOG)
  $list.set(SEED_LIST)
})

describe("$catalogView", () => {
  it("enriches every catalog item with its category name", () => {
    const view = $catalogView.get()

    expect(view).toHaveLength(3)
    expect(view[0]).toEqual({
      id: "item-1",
      name: "Apple",
      categoryId: "cat-1",
      categoryName: "Produce",
    })
    expect(view[1]).toEqual({
      id: "item-2",
      name: "Milk",
      categoryId: "cat-2",
      categoryName: "Dairy",
    })
  })

  it("falls back to 'Uncategorized' for items with a missing category", () => {
    const view = $catalogView.get()
    expect(view[2]).toEqual({
      id: "item-3",
      name: "Orphan",
      categoryId: "missing-cat",
      categoryName: "Uncategorized",
    })
  })
})

describe("$selectedView", () => {
  it("joins each list entry to its catalog item and category", () => {
    const view = $selectedView.get()

    expect(view).toHaveLength(2)
    expect(view[0]).toEqual({
      entryId: "entry-1",
      itemId: "item-1",
      name: "Apple",
      categoryId: "cat-1",
      categoryName: "Produce",
      checked: false,
      addedAt: 100,
    })
    expect(view[1]).toEqual({
      entryId: "entry-2",
      itemId: "item-2",
      name: "Milk",
      categoryId: "cat-2",
      categoryName: "Dairy",
      checked: true,
      addedAt: 200,
    })
  })

  it("preserves the order of $list", () => {
    $list.set([
      { id: "entry-3", itemId: "item-2", checked: false, addedAt: 300 },
      { id: "entry-4", itemId: "item-1", checked: true, addedAt: 400 },
    ])

    const view = $selectedView.get()
    expect(view.map((entry) => entry.entryId)).toEqual(["entry-3", "entry-4"])
  })
})

describe("$catalogByCategory", () => {
  it("returns an empty array when the catalog is empty", () => {
    $catalog.set([])
    expect($catalogByCategory.get()).toEqual([])
  })

  it("groups a single category's items under one entry", () => {
    $catalog.set([
      { id: "item-1", name: "Apple", categoryId: "cat-1" },
      { id: "item-2", name: "Banana", categoryId: "cat-1" },
    ])
    $categories.set([{ id: "cat-1", name: "Produce", frequency: "weekly" }])

    const groups = $catalogByCategory.get()
    expect(groups).toEqual([
      {
        categoryId: "cat-1",
        categoryName: "Produce",
        items: [
          { id: "item-1", name: "Apple", categoryId: "cat-1" },
          { id: "item-2", name: "Banana", categoryId: "cat-1" },
        ],
      },
    ])
  })

  it("keeps multiple categories in first-appearance order", () => {
    $catalog.set([
      { id: "item-1", name: "Apple", categoryId: "cat-1" },
      { id: "item-2", name: "Milk", categoryId: "cat-2" },
      { id: "item-3", name: "Banana", categoryId: "cat-1" },
    ])
    $categories.set([
      { id: "cat-1", name: "Produce", frequency: "weekly" },
      { id: "cat-2", name: "Dairy", frequency: "weekly" },
    ])

    const groups = $catalogByCategory.get()
    expect(groups.map((group) => group.categoryId)).toEqual(["cat-1", "cat-2"])
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it("uses categoryName from the catalog item and omits empty categories", () => {
    $catalog.set([
      { id: "item-1", name: "Apple", categoryId: "cat-1" },
      { id: "item-2", name: "Orphan", categoryId: "missing-cat" },
    ])
    $categories.set([
      { id: "cat-1", name: "Produce", frequency: "weekly" },
      // cat-2 has no items -> must not appear in the result.
      { id: "cat-2", name: "Dairy", frequency: "weekly" },
    ])

    const groups = $catalogByCategory.get()
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({
      categoryId: "cat-1",
      categoryName: "Produce",
      items: [{ id: "item-1", name: "Apple", categoryId: "cat-1" }],
    })
    expect(groups[1].categoryId).toBe("missing-cat")
    expect(groups[1].items).toHaveLength(1)
  })
})

describe("$listItemIds", () => {
  it("contains the itemIds currently on the list", () => {
    const ids = $listItemIds.get()

    expect(ids).toBeInstanceOf(Set)
    expect(ids.has("item-1")).toBe(true)
    expect(ids.has("item-2")).toBe(true)
    // Not on the list -> absent (O(1) membership check target).
    expect(ids.has("item-3")).toBe(false)
  })

  it("updates when the list changes", () => {
    expect($listItemIds.get().has("item-1")).toBe(true)

    $list.set([{ id: "entry-9", itemId: "item-3", checked: false, addedAt: 9 }])

    const ids = $listItemIds.get()
    expect(ids.has("item-1")).toBe(false)
    expect(ids.has("item-3")).toBe(true)
  })
})
