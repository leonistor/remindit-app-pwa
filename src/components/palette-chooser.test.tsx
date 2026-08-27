// Component test for the palette chooser (src/components/palette-chooser).
//
// Verifies it renders one option per pool palette, that selecting a palette
// updates the persisted active-palette store, and that the live preview recolors
// to reflect the active palette's colors.

import { afterEach, describe, expect, it } from "@rstest/core"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PALETTE_POOL, getPalette } from "@/lib/palettes"
import { categoryPalette } from "@/lib/category-palette"
import { PaletteChooser } from "@/components/palette-chooser"
import { $activePaletteId, setActivePalette } from "@/stores/palette"

const POOL_IDS = PALETTE_POOL.palettes.map((p) => p.id)
// The "paired" palette is selected in the store/recolor tests; its visible label
// is the palette name, not the id.
const PAIRED = PALETTE_POOL.palettes.find((p) => p.id === "paired")!

// Options render as `role="option"`; locate one by its visible palette name.
function optionFor(name: string): HTMLElement {
  const label = screen.getByText(name)
  const option = label.closest<HTMLElement>('[role="option"]')
  if (!option) throw new Error(`No listbox option found for "${name}"`)
  return option
}

afterEach(() => {
  cleanup()
  act(() => setActivePalette(PALETTE_POOL.palettes[0].id))
})

describe("PaletteChooser", () => {
  it("renders one option per palette in the pool", () => {
    render(<PaletteChooser />)
    expect(screen.getAllByRole("option")).toHaveLength(POOL_IDS.length)
  })

  it("updates the active palette store when an option is chosen", async () => {
    render(<PaletteChooser />)
    expect($activePaletteId.get()).toBe(PALETTE_POOL.palettes[0].id)

    await userEvent.click(optionFor(PAIRED.name))

    expect($activePaletteId.get()).toBe("paired")
  })

  it("shows the live preview chips", () => {
    render(<PaletteChooser />)
    expect(screen.getByText("Produce")).toBeInTheDocument()
    expect(screen.getByText("Dairy")).toBeInTheDocument()
  })

  it("recolors the live preview when the active palette changes", async () => {
    render(<PaletteChooser />)
    const chip = screen.getByText("Produce") as HTMLElement
    const before = chip.style.getPropertyValue("--cat")
    const defaultValue = categoryPalette(
      "Produce",
      undefined,
      getPalette("category10") ?? PALETTE_POOL.palettes[0]
    )
    expect(before).toBe(defaultValue.hex)

    await userEvent.click(optionFor(PAIRED.name))

    const after = (screen.getByText("Produce") as HTMLElement).style.getPropertyValue(
      "--cat"
    )
    const expectedAfter = categoryPalette(
      "Produce",
      undefined,
      getPalette("paired") ?? PALETTE_POOL.palettes[0]
    )
    expect(after).not.toBe(before)
    expect(after).toBe(expectedAfter.hex)
  })
})
