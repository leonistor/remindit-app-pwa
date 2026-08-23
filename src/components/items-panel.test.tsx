// Component test for ItemsPanel (src/components/items-panel).
//
// Renders the full catalog ($catalogView) as an Ark UI Listbox. Each card shows
// the item name and its category name. Clicking a card must call addToList(itemId),
// which appends an entry to $list and makes the check indicator appear. We seed
// $catalog/$categories/$list directly (importing the "@/stores" barrel runs
// initStores(), so we override the underlying stores after import) and reset
// before each test. The test also proves an onClick handler fires while the
// Listbox is in selectionMode="none".

import { afterEach, beforeEach, describe, expect, it } from "@rstest/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ItemsPanel from "@/components/items-panel"
import { $catalog, $categories, $list } from "@/stores"

const CAT_PRODUCE = "cat-produce"
const CAT_DAIRY = "cat-dairy"
const ITEM_APPLES = "item-apples"
const ITEM_MILK = "item-milk"

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
  // Start empty so nothing is "selected" and no check indicator renders.
  $list.set([])
})

afterEach(cleanup)

describe("ItemsPanel", () => {
  it("renders each catalog item with its name and category", () => {
    render(<ItemsPanel />)

    expect(screen.getByText("Apples")).toBeDefined()
    expect(screen.getByText("Produce")).toBeDefined()
    expect(screen.getByText("Milk")).toBeDefined()
    expect(screen.getByText("Dairy")).toBeDefined()
  })

  it("shows no check indicator for an item not yet on the list", () => {
    render(<ItemsPanel />)

    const row = screen.getByRole("option", { name: /Apples/ })
    expect(row.querySelector('[data-slot="listbox-item-indicator"]')).toBeNull()
  })

  it("adds the item to the list and shows the check indicator when clicked", async () => {
    const user = userEvent.setup()
    render(<ItemsPanel />)

    expect($list.get()).toHaveLength(0)

    const row = screen.getByRole("option", { name: /Apples/ })
    await user.click(row)

    // The click invokes addToList(item.id), appending an entry to $list.
    expect($list.get().some((entry) => entry.itemId === ITEM_APPLES)).toBe(true)

    // The check indicator now renders inside that item's row.
    const updatedRow = screen.getByRole("option", { name: /Apples/ })
    expect(
      updatedRow.querySelector('[data-slot="listbox-item-indicator"]')
    ).not.toBeNull()
  })

  it("adds the item via a plain fireEvent click as well", () => {
    render(<ItemsPanel />)

    const row = screen.getByRole("option", { name: /Milk/ })
    fireEvent.click(row)

    expect($list.get().some((entry) => entry.itemId === ITEM_MILK)).toBe(true)
    const updatedRow = screen.getByRole("option", { name: /Milk/ })
    expect(
      updatedRow.querySelector('[data-slot="listbox-item-indicator"]')
    ).not.toBeNull()
  })
})
