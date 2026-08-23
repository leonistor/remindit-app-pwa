// Component render test for ThemeToggle (src/components/theme-toggle).
//
// ThemeToggle is a controlled Ark UI ToggleGroup bound to `themeStore`. We only
// assert it renders the three mode options (Light / Dark / System) and reflects
// the store value when changed — using standard matchers only (no jest-dom).

import { describe, expect, it, beforeEach, afterEach } from "@rstest/core"
import { render, screen, cleanup } from "@testing-library/react"
import { ThemeToggle } from "@/components/theme-toggle"
import { themeStore, type ThemeMode } from "@/stores/theme"

const setMode = (mode: ThemeMode) => themeStore.set(mode)

beforeEach(() => {
  localStorage.clear()
  setMode("system")
})

// The project setup doesn't auto-clean between renders, so we do it explicitly
// to avoid DOM from a previous test leaking into queries.
afterEach(cleanup)

describe("ThemeToggle", () => {
  it("renders the three mode options", () => {
    render(<ThemeToggle />)

    // getByLabelText throws if missing, so a returned node proves presence.
    expect(screen.getByLabelText("Theme")).toBeDefined()
    expect(screen.getByLabelText("Light")).toBeDefined()
    expect(screen.getByLabelText("Dark")).toBeDefined()
    expect(screen.getByLabelText("System")).toBeDefined()
  })

  it("reflects the active mode from the store", () => {
    setMode("dark")
    render(<ThemeToggle />)

    // The active item is exposed via `data-state="on"` by Ark UI.
    const dark = screen.getByLabelText("Dark")
    expect(dark.getAttribute("data-state")).toBe("on")
  })
})
