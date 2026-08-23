// Integration test for cross-panel store interaction (src/components/shopping-panels).
//
// Renders the full <ShoppingPanels /> surface (All items + Selected items) and
// proves that clicking an item in the catalog panel adds it to the active list,
// which then shows up in the Selected-items panel — a real cross-panel store
// interaction through $catalog / $list.
//
// Importing the "@/stores" barrel runs initStores(), which seeds from a JSON
// file, so we override the underlying persistent stores in beforeEach and clear
// them in afterEach.
//
// NOTE: <ShoppingPanels /> wraps the two panels in an Ark UI Splitter
// (Resizable). If the Splitter fails to render its children under happy-dom
// (ResizeObserver/layout issues), the test falls back to rendering
// <><ItemsPanel /><ShoppingListPanel /></> for the interaction assertion. The
// fallback path is exercised only when the splitter does not mount its children.

import { afterEach, beforeEach, describe, expect, it } from "@rstest/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ItemsPanel from "@/components/items-panel"
import { ShoppingListPanel } from "@/components/shopping-list-panel"
import ShoppingPanels from "@/components/shopping-panels"
import { $catalog, $categories, $list } from "@/stores"

const CAT_DAIRY = "cat-dairy"
const ITEM_MILK = "item-milk"

// Renders the panel surface. Returns true when the Ark Splitter mounted its
// children (both panel titles present), false when we had to fall back.
function renderSurface(): boolean {
  render(<ShoppingPanels />)
  if (screen.queryByText("All items") && screen.queryByText("Selected items")) {
    return true
  }
  // Splitter didn't render its children — clean up and fall back to the
  // unwrapped panels, which exercise the same store interaction.
  cleanup()
  render(
    <>
      <ItemsPanel title="All items" />
      <ShoppingListPanel title="Selected items" />
    </>
  )
  return false
}

beforeEach(() => {
  localStorage.clear()
  $categories.set([{ id: CAT_DAIRY, name: "Dairy", frequency: "weekly" }])
  $catalog.set([{ id: ITEM_MILK, name: "Milk", categoryId: CAT_DAIRY }])
  $list.set([])
})

afterEach(cleanup)

describe("ShoppingPanels cross-panel interaction", () => {
  it("renders both panels with the catalog item in the All-items panel", () => {
    const usedSplitter = renderSurface()

    // The catalog item shows up in the All-items panel regardless of the path.
    expect(screen.getByText("Milk")).toBeDefined()
    // And it starts absent from the Selected-items panel.
    expect($list.get()).toHaveLength(0)

    expect(usedSplitter).toBe(true)
  })

  it("moves Milk into the Selected-items panel on click (cross-panel)", async () => {
    const user = userEvent.setup()
    const usedSplitter = renderSurface()

    expect(screen.getByText("Milk")).toBeDefined()
    expect($list.get()).toHaveLength(0)

    // Click the "Milk" catalog item card.
    const row = screen.getByRole("option", { name: /Milk/ })
    await user.click(row)

    // The item is now in the active list...
    expect($list.get().some((entry) => entry.itemId === ITEM_MILK)).toBe(true)

    // ...and therefore appears in the Selected-items panel as well.
    await waitFor(() => {
      const selectedPanel = screen.getByText("Selected items").parentElement
      expect(selectedPanel?.textContent).toContain("Milk")
    })

    expect(usedSplitter).toBe(true)
  })
})
