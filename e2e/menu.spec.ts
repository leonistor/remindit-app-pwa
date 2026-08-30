import { expect, type Page, test } from "@playwright/test"
import { onboard } from "./helpers"

// The menu is a single hamburger for every viewport (src/components/menu.tsx).
// "Shopping list" stays an always-visible direct link; the remaining routes live
// in the dropdown (the home route is excluded from the dropdown — see
// MOBILE_NAV_LINKS). This spec asserts that current behavior on both viewports.
const DROPDOWN_LINKS = ["Profile", "Catalog", "History", "About", "Help"]

const hamburger = (page: Page) => page.locator('button[aria-label="Open menu"]')
const closeButton = (page: Page) =>
  page.locator('button[aria-label="Close menu"]')
const dropdownLink = (page: Page, name: string) =>
  page.locator('[data-slot="menu-content"]').locator("a").getByText(name, {
    exact: true,
  })

test.describe("Single hamburger menu", () => {
  // The app gates on onboarding, so a fresh context would land on /onboarding and
  // never render the menu. Seed the onboarded flag before every test.
  test.beforeEach(async ({ page }) => {
    await onboard(page)
  })

  test("the direct 'Shopping list' link is visible and the hamburger opens the dropdown", async ({
    page,
  }) => {
    await page.goto("/")

    // The dedicated home link renders as a direct link.
    await expect(
      page.locator("a").getByText("Shopping list", { exact: true })
    ).toBeVisible()

    // Hamburger is present and the dropdown is initially closed.
    await expect(hamburger(page)).toBeVisible()
    await expect(page.locator('[data-slot="menu-content"]')).toBeHidden()

    await hamburger(page).click()
    await expect(closeButton(page)).toBeVisible()

    // Every non-home link appears inside the dropdown.
    for (const name of DROPDOWN_LINKS) {
      await expect(dropdownLink(page, name)).toBeVisible()
    }
  })

  test("mobile uses the same hamburger and a dropdown link navigates and closes it", async ({
    page,
  }) => {
    // Below the md (768px) breakpoint.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    // Same single hamburger on mobile.
    await expect(hamburger(page)).toBeVisible()
    await hamburger(page).click()

    await dropdownLink(page, "Catalog").click()
    await expect(page).toHaveURL(/\/catalog$/)
    await expect(hamburger(page)).toBeVisible()
  })
})
