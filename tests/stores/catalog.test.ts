// Unit tests for the catalog store (src/stores/catalog).
//
// We import submodules directly (NOT the `@/stores` barrel) because the barrel
// runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and `localStorage`
// are available without extra setup.

import { beforeEach, describe, expect, test } from "@rstest/core"
import {
  $catalog,
  addCatalogItem,
  removeCatalogItem,
  renameCatalogItem,
  updateCatalogItem,
} from "@/stores/catalog"
import { $history } from "@/stores/history"
import { $list, removeListEntriesForItem } from "@/stores/list"
import type { HistoryEvent } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

describe("catalog store", () => {
  beforeEach(resetStores)

  test("addCatalogItem appends a CatalogItem with a generated id and the given name/categoryId", () => {
    const item = addCatalogItem("Eggs", "cat-dairy")

    // Exactly one item in the store, and it is the returned object.
    const catalog = $catalog.get()
    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toBe(item)

    // The generated id is a non-empty string.
    expect(typeof item.id).toBe("string")
    expect(item.id.length).toBeGreaterThan(0)

    // Name and categoryId are passed through verbatim.
    expect(item.name).toBe("Eggs")
    expect(item.categoryId).toBe("cat-dairy")
  })

  test("updateCatalogItem patches name and/or categoryId correctly", () => {
    const item = addCatalogItem("Milk", "cat-dairy")

    // Patch only the name.
    updateCatalogItem(item.id, { name: "Skim Milk" })
    expect($catalog.get()[0]).toMatchObject({
      id: item.id,
      name: "Skim Milk",
      categoryId: "cat-dairy",
    })

    // Patch only the categoryId.
    updateCatalogItem(item.id, { categoryId: "cat-beverages" })
    expect($catalog.get()[0]).toMatchObject({
      id: item.id,
      name: "Skim Milk",
      categoryId: "cat-beverages",
    })

    // Patch both at once.
    updateCatalogItem(item.id, { name: "Oat Milk", categoryId: "cat-dairy" })
    expect($catalog.get()[0]).toEqual({
      id: item.id,
      name: "Oat Milk",
      categoryId: "cat-dairy",
    })

    // The total number of items is unchanged across updates.
    expect($catalog.get()).toHaveLength(1)
  })

  test("removeCatalogItem removes the item and cascades to drop referencing $list entries without writing history", () => {
    const item = addCatalogItem("Bread", "cat-bakery")

    // Seed a list entry that references the item, plus one unrelated entry.
    $list.set([
      { id: "entry-1", itemId: item.id, checked: false, addedAt: Date.now() },
      {
        id: "entry-2",
        itemId: "other-item",
        checked: false,
        addedAt: Date.now(),
      },
    ])

    // Seed one history event so we can prove removal writes no history.
    const seededHistory: HistoryEvent = {
      id: "hist-1",
      action: "add",
      itemId: "item-x",
      itemName: "Cheese",
      categoryId: "cat-dairy",
      timestamp: Date.now(),
    }
    $history.set([seededHistory])

    removeCatalogItem(item.id)

    // The catalog item is gone.
    expect($catalog.get()).toHaveLength(0)
    expect($catalog.get().find((i) => i.id === item.id)).toBeUndefined()

    // Only the referencing list entry is dropped; the unrelated one remains.
    const list = $list.get()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe("entry-2")

    // History is untouched — removal must NOT log anything.
    expect($history.get()).toHaveLength(1)
    expect($history.get()[0]).toBe(seededHistory)
  })

  test("removeListEntriesForItem drops only the entries referencing the given item", () => {
    $list.set([
      { id: "entry-a", itemId: "item-a", checked: false, addedAt: 1 },
      { id: "entry-b", itemId: "item-b", checked: false, addedAt: 2 },
      { id: "entry-c", itemId: "item-a", checked: true, addedAt: 3 },
    ])

    removeListEntriesForItem("item-a")

    const remaining = $list.get()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe("entry-b")
  })

  test("renameCatalogItem updates the name (symmetric with renameCategory)", () => {
    const item = addCatalogItem("Milk", "cat-dairy")

    renameCatalogItem(item.id, "Skim Milk")

    expect($catalog.get()[0]).toMatchObject({
      id: item.id,
      name: "Skim Milk",
      categoryId: "cat-dairy",
    })
  })

  test("renameCatalogItem no-ops on an empty name or an unchanged name", () => {
    const item = addCatalogItem("Milk", "cat-dairy")
    const before = $catalog.get()

    // Empty / whitespace-only renames are ignored.
    renameCatalogItem(item.id, "   ")

    // Renaming to the current (trimmed) name is also a no-op write.
    renameCatalogItem(item.id, "Milk")

    // The store array is referentially unchanged — no needless writes.
    expect($catalog.get()).toBe(before)
    expect($catalog.get()[0].name).toBe("Milk")
  })
})
