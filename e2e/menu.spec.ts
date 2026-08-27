import { expect, type Page, test } from "@playwright/test"

// Mirrors the navLinks config in src/components/menu.tsx. The home route renders
// with the label "Shopping list" on desktop and is excluded from the mobile
// dropdown (it has its own dedicated link on mobile).
const DESKTOP_LINKS = [
  "Shopping list",
  "Catalog",
  "History",
  "Settings",
  "About",
  "Help",
]
// Mobile dropdown omits the home route (see MOBILE_NAV_LINKS in menu.tsx).
const MOBILE_LINKS = DESKTOP_LINKS.filter((label) => label !== "Shopping list")

const desktopNavLink = (page: Page, name: string) =>
  page.locator("nav").locator("a").getByText(name, { exact: true })

const dropdownLink = (page: Page, name: string) =>
  page
    .locator('[data-slot="menu-content"]')
    .locator("a")
    .getByText(name, { exact: true })

test.describe("Responsive top menu", () => {
  test("desktop: all nav links are visible and the hamburger is hidden", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page.locator("nav").locator("a")).toHaveCount(
      DESKTOP_LINKS.length
    )
    for (const name of DESKTOP_LINKS) {
      await expect(desktopNavLink(page, name)).toBeVisible()
    }
    // Hamburger is desktop-hidden
    await expect(page.locator('button[aria-label="Open menu"]')).toBeHidden()
  })

  test("mobile: hamburger opens a dropdown of links; tapping one navigates and closes", async ({
    page,
  }) => {
    // Below the md (768px) breakpoint
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    // Desktop nav is collapsed on mobile
    for (const name of ["Catalog", "History", "Settings"]) {
      await expect(desktopNavLink(page, name)).toBeHidden()
    }

    const hamburger = page.locator('button[aria-label="Open menu"]')
    await expect(hamburger).toBeVisible()
    await expect(page.locator('[data-slot="menu-content"]')).toBeHidden()

    // Open the dropdown
    await hamburger.click()
    await expect(page.locator('button[aria-label="Close menu"]')).toBeVisible()

    // All (non-home) links appear inside the dropdown
    for (const name of MOBILE_LINKS) {
      await expect(dropdownLink(page, name)).toBeVisible()
    }

    // Navigating via the dropdown closes it and updates the URL
    await dropdownLink(page, "Catalog").click()
    await expect(page).toHaveURL(/\/catalog$/)
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible()
  })
})
