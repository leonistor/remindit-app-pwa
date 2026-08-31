// Component test for QuickAddDialog (src/components/quick-add-dialog).
//
// Regression coverage for the Enter-key duplication bug: `handleKeyDown` was
// attached to BOTH the Autocomplete root and the input, so a single Enter could
// run the Ark select flow (handleValueChange → createItemAndAddToList) AND
// createNewItem, producing a duplicate catalog item and list entry. The fix
// keeps the handler on the input only (composed ahead of Ark's keymap, blocked
// from double-running by its own preventDefault + the defaultPrevented guard).
//
// The dialog needs catalog + categories data, so each test seeds a small
// dataset via store actions and resets stores through the shared fixture.

import { afterEach, describe, expect, test } from "@rstest/core"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QuickAddDialog } from "@/components/quick-add-dialog"
import {
  $catalog,
  $list,
  addCatalogItem,
  addCategory,
  ensureUncategorizedExists,
} from "@/stores"
import { resetStores } from "../../tests/fixtures/reset"

let fridgeId = ""
let closeCalls: boolean[] = []

/** Number of catalog items with exactly the given name. */
function catalogItemsNamed(name: string): number {
  return $catalog.get().filter((item) => item.name === name).length
}

/**
 * Mount the open dialog with a fresh seed (Uncategorized sentinel + Fridge +
 * Produce + a "Milk" catalog item) and return the interaction handles.
 */
async function setupDialog() {
  cleanup()
  resetStores()
  ensureUncategorizedExists()
  fridgeId = addCategory("Fridge").id
  addCategory("Produce")
  addCatalogItem("Milk", fridgeId)

  closeCalls = []
  render(<QuickAddDialog open onOpenChange={(open) => closeCalls.push(open)} />)
  const input = screen.getByPlaceholderText("Add an item…") as HTMLInputElement
  const user = userEvent.setup()
  // Click to focus first: typing needs the combobox input active, and the
  // dialog's deferred auto-focus must not race the keystrokes.
  await user.click(input)
  return { input, user }
}

/** Type a value one char at a time (keeps Ark's per-keystroke sync in step). */
async function typeValue(user: userEvent.User, value: string) {
  for (const char of value) {
    await user.keyboard(char)
  }
}

afterEach(cleanup)

describe("QuickAddDialog", () => {
  test("selecting a catalog option adds exactly one list entry and closes", async () => {
    const { user } = await setupDialog()
    await typeValue(user, "milk")

    const optionText = screen.getByText("Milk")
    const option = optionText.closest<HTMLElement>('[role="option"]')
    if (!option) throw new Error('No listbox option found for "Milk"')
    await user.click(option)

    expect($catalog.get()).toHaveLength(1)
    expect($catalog.get()[0]?.name).toBe("Milk")
    expect($list.get()).toHaveLength(1)
    expect($list.get()[0]?.itemId).toBe($catalog.get()[0]?.id)
    expect(closeCalls).toContain(false)
  })

  test("pressing Enter on a novel typed value creates exactly one item", async () => {
    const { user } = await setupDialog()
    await typeValue(user, "quux")

    await user.keyboard("{Enter}")

    expect(catalogItemsNamed("quux")).toBe(1)
    expect($catalog.get()).toHaveLength(2)
    expect($list.get()).toHaveLength(1)
    expect(closeCalls).toContain(false)
  })

  test("pressing Enter on the highlighted create-row creates exactly one item", async () => {
    const { user } = await setupDialog()
    await typeValue(user, "quux")
    // Highlight the "Add “quux”" row so Enter also goes through Ark's select
    // flow — the historical double-create path.
    await user.keyboard("{ArrowDown}")

    await user.keyboard("{Enter}")

    expect(catalogItemsNamed("quux")).toBe(1)
    expect($catalog.get()).toHaveLength(2)
    expect($list.get()).toHaveLength(1)
    expect(closeCalls).toContain(false)
  })

  test("pressing Enter on a 1-2 char value does nothing", async () => {
    const { user } = await setupDialog()
    await typeValue(user, "ab")

    await user.keyboard("{Enter}")

    expect($catalog.get()).toHaveLength(1)
    expect($catalog.get()[0]?.name).toBe("Milk")
    expect($list.get()).toHaveLength(0)
    expect(closeCalls).not.toContain(false)
  })

  test("category pill creates the item under the chosen category and closes", async () => {
    const { user } = await setupDialog()
    await typeValue(user, "apple")

    await user.click(
      screen.getByRole("button", { name: "Add “apple” to Fridge" })
    )

    expect(catalogItemsNamed("apple")).toBe(1)
    const created = $catalog.get().find((item) => item.name === "apple")
    expect(created?.categoryId).toBe(fridgeId)
    expect($list.get()).toHaveLength(1)
    expect($list.get()[0]?.itemId).toBe(created?.id)
    expect(closeCalls).toContain(false)
  })
})
