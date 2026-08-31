import { expect, type Locator, type Page } from "@playwright/test"

// Shared helpers for e2e/demo-flows.spec.ts — the assertion-side counterparts of
// the selectors and setup tricks proven by scripts/demo-scenarios.ts.

/**
 * Seeds the persisted theme before the app boots. Re-applied on every
 * navigation (init script), so no navigation can paint with a flickering
 * "system" default — mirrors scripts/demo-scenarios.ts's addInitScript.
 */
export function seedTheme(page: Page, mode: "light" | "dark"): void {
  void page.addInitScript((mode) => {
    localStorage.setItem("remindit:theme", JSON.stringify(mode))
  }, mode)
}

/**
 * Walks the real onboarding UI (fresh storage → profile step → "Minimal
 * (starter)" → Finish) and waits for the seeded home view. Used by flows whose
 * assertions depend on the minimal dataset's catalog content (eggs, pasta,
 * milk…) — the localStorage-only `onboard()` helper would seed whatever
 * PUBLIC_DATASET the dev server was built with instead.
 */
export async function onboardViaUi(page: Page): Promise<void> {
  seedTheme(page, "light")
  await page.goto("/")

  // Dice button only renders on the onboarding step 1 (the router gates
  // un-onboarded users there). Profile generation is async (lazy DiceBear
  // chunk), so inputs stay `disabled` until it resolves — fill/click
  // auto-wait for enabled, but the first locator needs to exist first.
  const dice = page.getByRole("button", {
    name: "Roll a new random name and avatar",
  })
  await dice.waitFor({ state: "visible", timeout: 15_000 })

  await page.getByLabel("First name").fill("Jane")
  await page.getByLabel("Last name").fill("Doe")
  await page.getByRole("button", { name: "Next" }).click()
  await chooseDataset(page, "Minimal (starter)")
  await page.getByRole("button", { name: "Finish" }).click()

  // Home is seeded: empty-list copy in the list panel + catalog chips below.
  await page
    .getByText("Tap items below to add to the shopping list.")
    .waitFor({ timeout: 15_000 })
  await page
    .locator('[data-testid="catalog-item"]')
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
}

/**
 * Selects a seed-dataset segment in the onboarding step 2. getByRole("radio")
 * resolves to Ark's visually hidden input, which the visible segment label
 * covers — plain Playwright retries forever on "label intercepts pointer
 * events" (the demo recorder's raw-coordinate clicks bypass that check), so
 * click the label instead.
 */
export async function chooseDataset(page: Page, name: string): Promise<void> {
  await page
    .locator('[data-slot="segment-group-item"]')
    .filter({ hasText: name })
    .click()
}

/** Opens the hamburger dropdown and waits for its content. */
export async function openMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.locator('[data-slot="menu-content"]')).toBeVisible()
}

/**
 * Closes the hamburger dropdown if a selection left it open (menu radio items
 * close the whole menu in some paths, stay open in others).
 */
export async function closeMenuIfOpen(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close menu" })
  if (await close.isVisible().catch(() => false)) await close.click()
  await expect(page.locator('[data-slot="menu-content"]')).toBeHidden()
}

/**
 * Catalog chip scoped by testid: after an item is added, the same name also
 * exists as a shopping-list chip and a bare getByRole would multi-match
 * (the demo script's `.and()` trick).
 */
export function catalogChip(page: Page, name: string): Locator {
  return page
    .getByRole("button", { name })
    .and(page.locator('[data-testid="catalog-item"]'))
}
