// Tests that useCategoryPalette resolves the active palette + the category's
// stored color slot, and that it recolors mounted chips when $categories changes
// (the slot lookup is now backed by the $categoryById Map selector).

import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import { $categories } from "@/stores/categories"
import { useCategoryPalette } from "./use-category-palette"

// Rstest doesn't expose global `afterEach`, so Testing Library's auto-cleanup
// isn't registered; unmount between tests explicitly.
afterEach(cleanup)

// Expose the resolved hex (and the CSS var for the style) so a slot change is
// observable in the DOM without depending on specific palette hex values.
function Harness() {
  const palette = useCategoryPalette("cat-1")
  return (
    <div
      data-testid="palette"
      style={palette.style}
    >
      {palette.hex}
    </div>
  )
}

describe("useCategoryPalette", () => {
  beforeEach(() => {
    $categories.set([
      { id: "cat-1", name: "Produce", frequency: "weekly", color: 0 },
    ])
  })

  test("resolves the category's stored color slot to a real palette color", () => {
    render(<Harness />)
    // Slot 0 -> first palette color (a non-empty hex).
    expect(screen.getByTestId("palette").textContent).not.toBe("")
  })

  test("recolors mounted chips when the category slot changes", () => {
    render(<Harness />)
    const before = screen.getByTestId("palette").textContent

    act(() => {
      $categories.set([
        { id: "cat-1", name: "Produce", frequency: "weekly", color: 5 },
      ])
    })

    const after = screen.getByTestId("palette").textContent
    expect(after).not.toBe(before)
  })
})
