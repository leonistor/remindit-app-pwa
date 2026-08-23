// Component test for ShoppingListPanel (src/components/shopping-list-panel).
//
// Renders the active list via $selectedView as an Ark UI Listbox. Each row shows
// the item name (title) and its category name (subtitle). Clicking a row must
// call removeFromList(entryId), removing the entry from $list and making the row
// disappear. We seed $list/$catalog/$categories directly and reset before each
// test. The test also proves that an onClick handler fires while the Listbox is
// in selectionMode="none".

import { afterEach, beforeEach, describe, expect, it } from "@rstest/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ShoppingListPanel } from "@/components/shopping-list-panel"
import { $catalog, $categories, $list } from "@/stores"

const CAT_PRODUCE = "cat-produce"
const CAT_DAIRY = "cat-dairy"
const ITEM_APPLES = "item-apples"
const ITEM_MILK = "item-milk"
const ENTRY_1 = "entry-1"
const ENTRY_2 = "entry-2"

beforeEach(() => {
  localStorage.clear()
  $categories.set([
    { id: CAT_PRODUCE, name: "Produce", frequency: "weekly" },
    { id: CAT_DAIRY, name: "Dairy", frequency: "weekly" },
  ])
  $catalog.set([
    { id: ITEM_APPLES, name: "Apples", categoryId: CAT_PRODUCE },
    { id: ITEM_MILK, name: "Milk", categoryId: CAT_DAIRY },
  ])
  $list.set([
    { id: ENTRY_1, itemId: ITEM_APPLES, checked: false, addedAt: 1 },
    { id: ENTRY_2, itemId: ITEM_MILK, checked: false, addedAt: 2 },
  ])
})

afterEach(cleanup)

describe("ShoppingListPanel", () => {
  it("renders each selected entry with its item name and category", () => {
    render(<ShoppingListPanel />)

    // getByText throws if the node is missing, asserting presence.
    expect(screen.getByText("Apples")).toBeDefined()
    expect(screen.getByText("Produce")).toBeDefined()
    expect(screen.getByText("Milk")).toBeDefined()
    expect(screen.getByText("Dairy")).toBeDefined()
  })

  it("removes the entry from the store when its row is clicked", async () => {
    const user = userEvent.setup()
    render(<ShoppingListPanel />)

    expect($list.get()).toHaveLength(2)

    const row = screen.getByRole("option", { name: /Apples/ })
    await user.click(row)

    // The entry is removed from $list by removeFromList.
    const remaining = $list.get()
    expect(remaining).toHaveLength(1)
    expect(remaining.some((entry) => entry.id === ENTRY_1)).toBe(false)
    expect(remaining.some((entry) => entry.id === ENTRY_2)).toBe(true)

    // The removed row disappears from the DOM; the other remains.
    expect(screen.queryByText("Apples")).toBeNull()
    expect(screen.getByText("Milk")).toBeDefined()
  })

  it("removes the correct entry when a different row is clicked", () => {
    render(<ShoppingListPanel />)

    const row = screen.getByRole("option", { name: /Milk/ })
    fireEvent.click(row)

    const remaining = $list.get()
    expect(remaining).toHaveLength(1)
    expect(remaining.some((entry) => entry.id === ENTRY_2)).toBe(false)
    expect(screen.queryByText("Milk")).toBeNull()
  })
})
