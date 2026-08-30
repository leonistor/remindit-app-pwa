// Unit tests for the list store (src/stores/list).
//
// We import submodules directly (NOT the `@/stores` barrel) because the barrel
// runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.
//
// Strategy: assert history *counts and shapes* rather than exact random ids or
// timestamps, since those are generated at runtime.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { addCatalogItem } from "@/stores/catalog"
import { $history } from "@/stores/history"
import {
  $list,
  addToList,
  clearList,
  removeFromList,
  removeListEntriesForItem,
  setEntryChecked,
} from "@/stores/list"
import { resetStores } from "../fixtures/reset"

describe("list store", () => {
  beforeEach(resetStores)

  test("addToList adds one entry and logs one 'add' event", () => {
    const item = addCatalogItem("Milk", "cat-dairy")

    addToList(item.id)

    const list = $list.get()
    expect(list).toHaveLength(1)
    expect(list[0].itemId).toBe(item.id)
    expect(list[0].checked).toBe(false)

    const events = $history.get()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe("add")
    expect(events[0].itemId).toBe(item.id)
    expect(events[0].itemName).toBe("Milk")
    expect(events[0].categoryId).toBe("cat-dairy")
  })

  test("addToList is a no-op for an unknown itemId", () => {
    addToList("does-not-exist")

    expect($list.get()).toHaveLength(0)
    expect($history.get()).toHaveLength(0)
  })

  test("addToList does not duplicate the same itemId", () => {
    const item = addCatalogItem("Eggs", "cat-dairy")

    addToList(item.id)
    addToList(item.id)

    expect($list.get()).toHaveLength(1)
    expect($history.get()).toHaveLength(1)
  })

  test("removeFromList removes the entry and logs one 'remove' event", () => {
    const item = addCatalogItem("Bread", "cat-bakery")
    addToList(item.id)
    const entryId = $list.get()[0].id

    removeFromList(entryId)

    expect($list.get()).toHaveLength(0)
    const events = $history.get()
    expect(events).toHaveLength(2)
    expect(events[0].action).toBe("add")
    expect(events[1].action).toBe("remove")
    expect(events[1].itemId).toBe(item.id)
    expect(events[1].itemName).toBe("Bread")
    expect(events[1].categoryId).toBe("cat-bakery")
  })

  test("setEntryChecked toggles checked without writing history", () => {
    const item = addCatalogItem("Cheese", "cat-dairy")
    addToList(item.id)
    const entryId = $list.get()[0].id

    setEntryChecked(entryId, true)
    expect($list.get()[0].checked).toBe(true)

    setEntryChecked(entryId, false)
    expect($list.get()[0].checked).toBe(false)

    // Only the original 'add' event exists; toggling never logs history.
    expect($history.get()).toHaveLength(1)
  })

  test("clearList empties $list without writing history", () => {
    const a = addCatalogItem("Apples", "cat-produce")
    const b = addCatalogItem("Pears", "cat-produce")
    addToList(a.id)
    addToList(b.id)
    expect($list.get()).toHaveLength(2)

    clearList()

    expect($list.get()).toEqual([])
    // The two 'add' events remain untouched.
    expect($history.get()).toHaveLength(2)
  })

  test("removeListEntriesForItem drops matching entries without writing history", () => {
    const a = addCatalogItem("Onion", "cat-produce")
    const b = addCatalogItem("Garlic", "cat-produce")
    addToList(a.id)
    addToList(b.id)
    expect($list.get()).toHaveLength(2)

    removeListEntriesForItem(a.id)

    const list = $list.get()
    expect(list).toHaveLength(1)
    expect(list[0].itemId).toBe(b.id)
    // Removal cascades without logging any history.
    expect($history.get()).toHaveLength(2)
  })
})
