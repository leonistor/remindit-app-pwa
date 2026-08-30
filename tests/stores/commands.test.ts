// Unit tests for the commands layer (src/stores/commands).
//
// Commands compose the single-resource store modules into cross-store flows, so
// we assert against the individual atoms and the history store. We import
// submodules directly (NOT the `@/stores` barrel) because the barrel runs
// `initStores` + a dev logger as a side effect.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $catalog, addCatalogItem } from "@/stores/catalog"
import { $categories, addCategory } from "@/stores/categories"
import {
  createItemAndAddToList,
  deleteCatalogItemWithCascade,
  deleteCategoryWithReassign,
} from "@/stores/commands"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import type { HistoryEvent } from "@/stores/types"
import { UNCATEGORIZED_ID } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

describe("stores commands", () => {
  beforeEach(resetStores)

  test("deleteCategoryWithReassign reassigns catalog items to UNCATEGORIZED and drops the category (no history)", () => {
    const category = addCategory("Produce")
    const item = addCatalogItem("Apple", category.id)

    const historyBefore = $history.get().length

    deleteCategoryWithReassign(category.id)

    // The catalog item now points at the sentinel category.
    const updatedItem = $catalog.get().find((i) => i.id === item.id)
    expect(updatedItem?.categoryId).toBe(UNCATEGORIZED_ID)

    // The category itself is gone from the list.
    expect($categories.get().some((c) => c.id === category.id)).toBe(false)

    // Deleting a category must NOT write history.
    expect($history.get()).toHaveLength(historyBefore)
  })

  test("deleteCategoryWithReassign is a no-op for UNCATEGORIZED_ID", () => {
    $categories.set([
      { id: UNCATEGORIZED_ID, name: "Uncategorized", frequency: "unknown" },
      { id: "cat-produce", name: "Produce", frequency: "unknown" },
    ])

    deleteCategoryWithReassign(UNCATEGORIZED_ID)

    const categories = $categories.get()
    expect(categories.some((c) => c.id === UNCATEGORIZED_ID)).toBe(true)
    expect(categories.some((c) => c.id === "cat-produce")).toBe(true)
  })

  test("deleteCatalogItemWithCascade removes the item and drops referencing $list entries without writing history", () => {
    const item = addCatalogItem("Bread", "cat-bakery")

    $list.set([
      { id: "entry-1", itemId: item.id, checked: false, addedAt: Date.now() },
      { id: "entry-2", itemId: "other-item", checked: false, addedAt: Date.now() },
    ])

    const seededHistory: HistoryEvent = {
      id: "hist-1",
      action: "add",
      itemId: "item-x",
      itemName: "Cheese",
      categoryId: "cat-dairy",
      timestamp: Date.now(),
    }
    $history.set([seededHistory])

    deleteCatalogItemWithCascade(item.id)

    expect($catalog.get()).toHaveLength(0)
    expect($catalog.get().find((i) => i.id === item.id)).toBeUndefined()

    const list = $list.get()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe("entry-2")

    // History is untouched — removal must NOT log anything.
    expect($history.get()).toHaveLength(1)
    expect($history.get()[0]).toBe(seededHistory)
  })

  test("createItemAndAddToList creates a catalog item, adds an entry, and logs one 'add'", () => {
    createItemAndAddToList("Banana", "cat-produce")

    expect($catalog.get()).toHaveLength(1)
    expect($catalog.get()[0].name).toBe("Banana")
    expect($catalog.get()[0].categoryId).toBe("cat-produce")

    expect($list.get()).toHaveLength(1)
    expect($list.get()[0].itemId).toBe($catalog.get()[0].id)

    const events = $history.get()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe("add")
    expect(events[0].itemName).toBe("Banana")
    expect(events[0].categoryId).toBe("cat-produce")
  })
})
