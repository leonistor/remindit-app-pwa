// Component test for ItemButton (src/components/ui/custom/item-button).
//
// Verifies the decoupling from Button's action variants: the rendered chip
// carries its categorical palette tint (not a `Button` semantic variant) and
// the recommendation dot remains a distinct, semantic concern.

import { afterEach, describe, expect, test } from "@rstest/core"
import { cleanup, render, screen } from "@testing-library/react"
import { ItemButton } from "@/components/ui/custom/item-button"

// The project setup doesn't auto-clean between renders, so clean explicitly to
// avoid DOM from a previous test leaking into queries.
afterEach(cleanup)

describe("ItemButton", () => {
  test("renders the name and applies a categorical palette tint", () => {
    render(<ItemButton name="Milk" purpose="selectable" categoryKey="dairy" />)

    const button = screen.getByRole("button", { name: "Milk" })
    // Palette tint is applied directly via the `--cat` CSS var (solid
    // background, qualitative color), not a Button semantic variant class like
    // `bg-info` / `bg-success`.
    expect(button.className).toMatch(/bg-\[var\(--cat\)\]/)
    expect(button.className).not.toContain("bg-success")
    expect(button.className).not.toContain("bg-info")
  })

  test("dims a selected selectable item instead of emphasizing it", () => {
    const { rerender } = render(
      <ItemButton
        name="Milk"
        purpose="selectable"
        categoryKey="dairy"
        isSelected={false}
      />
    )
    const idle = screen.getByRole("button", { name: "Milk" })
    expect(idle.className).not.toContain("var(--cat-dim)")
    // No standing (unconditional) emphasis ring at rest — a desktop hover ring
    // (`hover:ring-2`) is allowed, so reject only a variant-less `ring-2`.
    expect(idle.className).not.toMatch(/(?<!:)ring-2/)

    rerender(
      <ItemButton
        name="Milk"
        purpose="selectable"
        categoryKey="dairy"
        isSelected
      />
    )
    const selected = screen.getByRole("button", { name: "Milk" })
    expect(selected.className).toContain("var(--cat-dim)")
    expect(selected.className).not.toMatch(/(?<!:)ring-2/)
  })

  test("renders a recommendation dot as a separate semantic concern", () => {
    render(
      <ItemButton
        name="Eggs"
        purpose="recommendation"
        categoryKey="eggs"
        recommendationTier="overdue"
      />
    )

    const dot = document.querySelector('[aria-hidden="true"]')
    expect(dot).not.toBeNull()
    expect(dot?.className).toContain("bg-destructive")
  })
})
