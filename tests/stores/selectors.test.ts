// Unit tests for the derived selectors (src/stores/selectors).
//
// We import each submodule directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `localStorage` and `crypto.randomUUID()`
// are available without extra setup (see tests/stores/history.test.ts).

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $categories } from "@/stores/categories"
import { $catalog } from "@/stores/catalog"
import { $list, addToList, setEntryChecked } from "@/stores/list"
import {
  $activeCategoryIds,
  $checkedCount,
  $itemsByCategory,
  $listCount,
} from "@/stores/selectors"
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
})
