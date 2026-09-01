import { expect, type Page, test } from "@playwright/test"
import { onboard } from "./helpers"

// The /share view exports the current list as a PNG rendered in-browser with
// snapdom. `onboard()` seeds the catalog/history but the active list starts
// empty (the card only shows unchecked items), so the card tests add an item
// through the home view first. The item is whichever catalog chip renders
// first — kept dataset-agnostic because the dev server's PUBLIC_DATASET may
// differ from the minimal starter.
const menuLink = (page: Page, name: string) =>
  page.locator('[data-slot="menu-content"]').locator("a").getByText(name, {
    exact: true,
  })

const shareCard = (page: Page) => page.locator('[data-testid="share-card"]')

async function openShareViaMenu(page: Page): Promise<void> {
  await page.locator('button[aria-label="Open menu"]').click()
  await menuLink(page, "Share").click()
  await expect(page).toHaveURL(/\/share$/)
}

/** Adds the first visible catalog item and returns its display name. */
async function addFirstCatalogItem(page: Page): Promise<string> {
  const chip = page.locator('[data-testid="catalog-item"]').first()
  await chip.waitFor({ state: "visible", timeout: 15_000 })
  const name = (await chip.innerText()).trim()
  await chip.click()
  return name
}

test.describe("Share view", () => {
  // The app gates on onboarding — seed the flag before every test.
  test.beforeEach(async ({ page }) => {
    await onboard(page)
  })

  test("the menu exposes a Share link that lands on /share with the header visible", async ({
    page,
  }) => {
    await page.goto("/")

    await openShareViaMenu(page)

    await expect(
      page.getByRole("heading", { level: 1, name: "Share" })
    ).toBeVisible()
  })

  test("the capture card renders an unchecked item added from the catalog", async ({
    page,
  }) => {
    await page.goto("/")
    const name = await addFirstCatalogItem(page)

    await openShareViaMenu(page)

    await expect(shareCard(page)).toBeVisible()
    await expect(shareCard(page)).toContainText(name)
  })

  test("Download PNG triggers a remindit-list-*.png download", async ({
    page,
  }) => {
    await page.goto("/")
    await addFirstCatalogItem(page)

    await openShareViaMenu(page)

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download PNG" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(
      /^remindit-list-\d{4}-\d{2}-\d{2}\.png$/
    )
  })
})
