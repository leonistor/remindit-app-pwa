// Unit tests for the derived selectors (src/stores/selectors).
//
// We import each submodule directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `localStorage` and `crypto.randomUUID()`
// are available without extra setup (see tests/stores/history.test.ts).

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $list, addToList, setEntryChecked } from "@/stores/list"
import {
  $activeCategoryIds,
  $catalogByCategory,
  $catalogView,
  $categoryById,
  $checkedCount,
  $itemsByCategory,
  $listCount,
  $listItemIds,
  $selectedView,
} from "@/stores/selectors"
import type { CatalogItem, Category, ListEntry } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

// Deterministic seed. NOTE: $categories is intentionally ordered [b, a] so that
// $itemsByCategory preserves that order (B group first, then A). The selectors
// mirror $categories order exactly, so the seed order is what drives the
// asserted "B first, then A" result. Each list entry references a catalog item
// whose `categoryId` decides which group it lands in.
function seed(): void {
  $categories.set([
    { id: "b", name: "B", frequency: "unknown" },
    { id: "a", name: "A", frequency: "unknown" },
  ])
  $catalog.set([
    { id: "i1", name: "Item1", categoryId: "b" },
    { id: "i2", name: "Item2", categoryId: "a" },
  ])
  $list.set([
    { id: "e1", itemId: "i1", checked: false, addedAt: 1 },
    { id: "e2", itemId: "i2", checked: false, addedAt: 2 },
  ])
}

describe("selectors", () => {
  beforeEach(() => {
    resetStores()
    seed()
  })

  test("$itemsByCategory groups entries by category in $categories order (B first, then A)", () => {
    const groups = $itemsByCategory.get()

    // Only categories that actually have a list entry are returned.
    expect(groups).toHaveLength(2)

    // B group comes first because $categories is ordered [b, a].
    expect(groups[0].category.id).toBe("b")
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].entry.id).toBe("e1")
    expect(groups[0].items[0].item.id).toBe("i1")
    expect(groups[0].items[0].item.name).toBe("Item1")

    // A group is second, with its own item.
    expect(groups[1].category.id).toBe("a")
    expect(groups[1].items).toHaveLength(1)
    expect(groups[1].items[0].entry.id).toBe("e2")
    expect(groups[1].items[0].item.id).toBe("i2")
    expect(groups[1].items[0].item.name).toBe("Item2")
  })

  test("$activeCategoryIds equals the ids of the grouped categories (['b','a'])", () => {
    expect($activeCategoryIds.get()).toEqual(["b", "a"])
  })

  test("$listCount reflects the number of list entries", () => {
    expect($listCount.get()).toBe(2)
  })

  test("$checkedCount increments once an entry is checked", () => {
    expect($checkedCount.get()).toBe(0)
    setEntryChecked("e1", true)
    expect($checkedCount.get()).toBe(1)
  })

  test("addToList appends a new entry sourced from the catalog", () => {
    // Extend the catalog with an item not yet on the list, then add it.
    $catalog.set([
      ...$catalog.get(),
      { id: "i3", name: "Item3", categoryId: "a" },
    ])
    expect($listCount.get()).toBe(2)
    addToList("i3")
    expect($listCount.get()).toBe(3)
  })

  test("$categoryById is an O(1) id -> category Map", () => {
    const byId = $categoryById.get()
    expect(byId.get("b")).toEqual({ id: "b", name: "B", frequency: "unknown" })
    expect(byId.get("a")).toEqual({ id: "a", name: "A", frequency: "unknown" })
    expect(byId.get("missing")).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Panel selectors (catalog view / selected view / grouped catalog / list ids)
// ---------------------------------------------------------------------------

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

describe("$catalogView", () => {
  beforeEach(() => {
    $categories.set(SEED_CATEGORIES)
    $catalog.set(SEED_CATALOG)
    $list.set(SEED_LIST)
  })

  test("enriches every catalog item with its category name", () => {
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

  test("falls back to 'Uncategorized' for items with a missing category", () => {
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
  beforeEach(() => {
    $categories.set(SEED_CATEGORIES)
    $catalog.set(SEED_CATALOG)
    $list.set(SEED_LIST)
  })

  test("joins each list entry to its catalog item and category", () => {
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

  test("preserves the order of $list", () => {
    $list.set([
      { id: "entry-3", itemId: "item-2", checked: false, addedAt: 300 },
      { id: "entry-4", itemId: "item-1", checked: true, addedAt: 400 },
    ])

    const view = $selectedView.get()
    expect(view.map((entry) => entry.entryId)).toEqual(["entry-3", "entry-4"])
  })
})

describe("$catalogByCategory", () => {
  test("returns an empty array when the catalog is empty", () => {
    $catalog.set([])
    expect($catalogByCategory.get()).toEqual([])
  })

  test("groups a single category's items under one entry", () => {
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

  test("keeps multiple categories in first-appearance order", () => {
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

  test("uses categoryName from the catalog item and omits empty categories", () => {
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
  beforeEach(() => {
    $categories.set(SEED_CATEGORIES)
    $catalog.set(SEED_CATALOG)
    $list.set(SEED_LIST)
  })

  test("contains the itemIds currently on the list", () => {
    const ids = $listItemIds.get()

    expect(ids).toBeInstanceOf(Set)
    expect(ids.has("item-1")).toBe(true)
    expect(ids.has("item-2")).toBe(true)
    // Not on the list -> absent (O(1) membership check target).
    expect(ids.has("item-3")).toBe(false)
  })

  test("updates when the list changes", () => {
    expect($listItemIds.get().has("item-1")).toBe(true)

    $list.set([{ id: "entry-9", itemId: "item-3", checked: false, addedAt: 9 }])

    const ids = $listItemIds.get()
    expect(ids.has("item-1")).toBe(false)
    expect(ids.has("item-3")).toBe(true)
  })
})
