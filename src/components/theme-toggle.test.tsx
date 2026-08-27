// Component render test for ThemeToggle (src/components/theme-toggle).
//
// ThemeToggle is now a single ghost icon button showing the active theme's
// icon; clicking it cycles light -> dark -> system -> light through
// `$theme`. We assert it renders one button reflecting the store value and
// that clicking advances the mode — using standard matchers only (no jest-dom).

import { afterEach, beforeEach, describe, expect, it } from "@rstest/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ThemeToggle } from "@/components/theme-toggle"
import { type ThemeMode, $theme } from "@/stores/theme"

const setMode = (mode: ThemeMode) => $theme.set(mode)

beforeEach(() => {
  localStorage.clear()
  setMode("system")
})

// The project setup doesn't auto-clean between renders, so we do it explicitly
// to avoid DOM from a previous test leaking into queries.
afterEach(cleanup)

describe("ThemeToggle", () => {
  it("renders a single button reflecting the active theme", () => {
    setMode("dark")
    render(<ThemeToggle />)

    const button = screen.getByRole("button", { name: /Theme/ })
    expect(button).toBeDefined()
    expect(button.getAttribute("aria-label")).toContain("Dark")
  })

  it("cycles to the next theme when clicked", () => {
    setMode("light")
    render(<ThemeToggle />)

    const button = screen.getByRole("button", { name: /Theme/ })
    fireEvent.click(button)

    expect($theme.get()).toBe("dark")
  })
})
