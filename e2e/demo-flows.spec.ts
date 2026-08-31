import { expect, test } from "@playwright/test"
import {
  catalogChip,
  chooseDataset,
  closeMenuIfOpen,
  onboardViaUi,
  openMenu,
  seedTheme,
} from "./demo-helpers"
import { onboard } from "./helpers"

// Asserts (not records) the seven user flows exercised by
// scripts/demo-scenarios.ts — see docs/REVIEW-PLAN.md §W8. Selectors are the
// ones the recorder already proved; each test gets a fresh localStorage, so
// flows 2/5/7 reuse the cheap `onboard()` seed while flows 3/4/6 walk the real
// onboarding to guarantee the "Minimal (starter)" catalog their assertions
// depend on (the dev server's PUBLIC_DATASET may differ).

test.describe("Remindit demo flows (dev mode)", () => {
  // --- 1 — onboarding -------------------------------------------------------
  test("onboarding: fresh install → profile → minimal dataset → seeded home", async ({
    page,
  }) => {
    seedTheme(page, "light")
    await page.goto("/")

    // Fresh storage → the router gates the first run to /onboarding.
    await expect(page).toHaveURL(/\/onboarding$/)

    // Welcome step (intro video + demo) — a single visible Next advances to
    // the profile step.
    await page.getByRole("button", { name: "Next" }).click()

    const dice = page.getByRole("button", {
      name: "Roll a new random name and avatar",
    })
    // Profile generation is async (lazy DiceBear chunk) on first paint.
    await expect(dice).toBeVisible({ timeout: 15_000 })

    // Reroll once: the suggested username must survive the roll (random word
    // pairs can theoretically repeat, so assert non-empty, not "changed").
    await dice.click()
    await expect(page.getByLabel("Username")).not.toBeEmpty()

    await page.getByLabel("First name").fill("Jane")
    await page.getByLabel("Last name").fill("Doe")
    await page.getByRole("button", { name: "Next" }).click()
    await chooseDataset(page, "Minimal (starter)")
    await page.getByRole("button", { name: "Finish" }).click()

    // Home with a seeded catalog: empty-list copy + non-empty catalog chips.
    await expect(
      page.getByText("Tap items below to add to the shopping list.")
    ).toBeVisible()
    const chips = page.locator('[data-testid="catalog-item"]')
    await expect(chips.first()).toBeVisible()
    expect(await chips.count()).toBeGreaterThan(0)
  })

  // --- 2 — install banner ---------------------------------------------------
  test("install banner: mocked beforeinstallprompt → banner → 'Maybe later' dismisses", async ({
    page,
  }) => {
    await onboard(page)
    await page.goto("/")
    await expect(
      page.getByRole("button", { name: "Add to shopping list" })
    ).toBeVisible()

    // No real beforeinstallprompt in a Playwright context — dispatch a mock
    // (pwa-install-handler's window listener persists post-load).
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true })
      const mock = e as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: string; platform: string }>
      }
      mock.prompt = async () => {}
      mock.userChoice = Promise.resolve({
        outcome: "accepted",
        platform: "web",
      })
      window.dispatchEvent(mock)
    })

    // Banner mounts 1.5s after canInstall flips.
    const later = page.getByRole("button", { name: "Maybe later" })
    await expect(later).toBeVisible({ timeout: 6000 })
    await later.click()
    await expect(later).toBeHidden({ timeout: 3000 })
  })

  // --- 3 — add items to shopping list ---------------------------------------
  test("catalog add: fridge/snacks chips toggle onto the shopping list", async ({
    page,
  }) => {
    await onboardViaUi(page)

    // The catalog accordion starts with only the first (cooking) category
    // open; open the two categories the flow pulls chips from.
    await page.getByRole("button", { name: /fridge/i }).click()
    await page.getByRole("button", { name: /snacks/i }).click()

    // Scope to catalog chips — after adding, the same name also exists in the
    // list panel and getByRole alone would multi-match.
    for (const item of ["eggs", "pasta"]) {
      await catalogChip(page, item).click()
    }

    const listItems = page.locator('[data-testid="shopping-item"]')
    await expect(listItems.filter({ hasText: "eggs" })).toHaveCount(1)
    await expect(listItems.filter({ hasText: "pasta" })).toHaveCount(1)
  })

  // --- 4 — quick add ----------------------------------------------------------
  test("quick add: select existing 'milk' and one-tap create novel 'apple'", async ({
    page,
  }) => {
    await onboardViaUi(page)

    const plus = page.getByRole("button", { name: "Add to shopping list" })
    const input = page.getByPlaceholder("Add an item…")
    const done = page.getByRole("button", { name: "Done", exact: true })

    // Existing item via autocomplete (catalog name is lowercase; role-name
    // matching is case-insensitive).
    await plus.click()
    await expect(input).toBeVisible({ timeout: 3000 })
    await input.fill("milk")
    await page.getByRole("option", { name: "Milk" }).click()
    await expect(done).toBeHidden({ timeout: 3000 })
    await expect(
      page.locator('[data-testid="shopping-item"]').filter({ hasText: "milk" })
    ).toHaveCount(1)

    // New item: type a novel name, then one-tap create via the category pill —
    // the pill IS the create action (creates + closes the dialog). Curly
    // quotes are part of the exact label format. On the REOPENED dialog a
    // single programmatic fill is swallowed by Ark's combobox state (left over
    // from the option-select close), so mirror the demo's humanized input:
    // click into the field first, then type per-char.
    await plus.click()
    await expect(input).toBeVisible({ timeout: 3000 })
    await input.click()
    await page.waitForTimeout(300)
    await input.pressSequentially("apple", { delay: 70 })
    await page.getByRole("button", { name: "Add “apple” to Fridge" }).click()
    await expect(done).toBeHidden({ timeout: 3000 })
    await expect(
      page.locator('[data-testid="shopping-item"]').filter({ hasText: "apple" })
    ).toHaveCount(1)
  })

  // --- 5 — theme selection ---------------------------------------------------
  test("theme: menu submenu flips Dark and back to Light on <html>", async ({
    page,
  }) => {
    seedTheme(page, "light")
    await onboard(page)
    await page.goto("/")

    await openMenu(page)
    await page.getByRole("menuitem", { name: "Theme" }).click()
    await page.getByRole("menuitemradio", { name: "Dark" }).click()

    // The app marks dark with a `dark` class on <html> (src/stores/theme.ts)
    // and persists the mode JSON-encoded.
    const html = page.locator("html")
    await expect(html).toHaveClass(/dark/)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("remindit:theme")))
      .toBe('"dark"')

    // Flip back — reopening handles both post-radio menu states.
    await closeMenuIfOpen(page)
    await openMenu(page)
    await page.getByRole("menuitem", { name: "Theme" }).click()
    await page.getByRole("menuitemradio", { name: "Light" }).click()
    await expect(html).not.toHaveClass(/dark/)
    await closeMenuIfOpen(page)
  })

  // --- 6 — edit catalog --------------------------------------------------------
  test("catalog CRUD: add → rename → delete with confirmation", async ({
    page,
  }) => {
    await onboardViaUi(page)

    // Menu nav links render as menuitem (Zag MenuItem asChild overrides the
    // anchor's implicit link role) — not getByRole("link").
    await openMenu(page)
    await page.getByRole("menuitem", { name: "Catalog" }).click()
    await expect(page).toHaveURL(/\/catalog$/)
    await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible()

    // Add "Honey" to Fridge. exact:true — "Add item" also substring-matches
    // every per-category "Add item to {name}" button.
    await page.getByRole("button", { name: "Add item", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible({ timeout: 3000 })
    // getByLabel is broken in this dialog (labels lack htmlFor) — use the
    // placeholder.
    await dialog.getByPlaceholder("e.g. Milk").fill("Honey")
    await dialog.locator('[data-slot="select-trigger"]').click()
    await page.getByRole("option", { name: "Fridge" }).click()
    await dialog.getByRole("button", { name: "Add", exact: true }).click()
    await expect(dialog).toBeHidden({ timeout: 3000 })

    // Rename. Desktop Chrome viewport → the table row edits on double-click
    // (tap-to-edit is the mobile verb); same dialog, placeholder input.
    const row = page.getByRole("button", { name: /Edit Honey/ })
    await expect(row).toBeVisible({ timeout: 3000 })
    await row.dblclick()
    const editDialog = page.getByRole("dialog")
    await expect(editDialog).toBeVisible({ timeout: 3000 })
    const nameInput = editDialog.getByPlaceholder("e.g. Milk")
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    await nameInput.click()
    await page.keyboard.press("ControlOrMeta+A")
    await nameInput.pressSequentially("Raw Honey")
    await editDialog.getByRole("button", { name: "Save", exact: true }).click()
    await expect(editDialog).toBeHidden({ timeout: 3000 })
    await expect(
      page.getByRole("button", { name: /Edit Raw Honey/ })
    ).toBeVisible()

    // Delete. Swipe-left is touch-only (trackMouse: false in
    // SwipeableItemRow) and the revealed button only exists on the mobile
    // layout — on the desktop table the row exposes an inline delete trigger
    // (ConfirmDelete) instead; both paths open the same alertdialog.
    await page.getByRole("button", { name: "Delete Raw Honey" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm).toBeVisible({ timeout: 3000 })
    await confirm.getByRole("button", { name: "Delete item" }).click()
    await expect(confirm).toBeHidden({ timeout: 3000 })
    await expect(
      page.getByRole("button", { name: /Edit Raw Honey/ })
    ).toHaveCount(0)
  })

  // --- 7 — install instructions ----------------------------------------------
  test("install instructions: appinstalled → menu item → manual dialog closes", async ({
    page,
  }) => {
    await onboard(page)
    await page.goto("/")
    await expect(
      page.getByRole("button", { name: "Add to shopping list" })
    ).toBeVisible()

    // Retire any captured beforeinstallprompt (simulates the app having been
    // installed at OS level): canInstall flips false, $installed stays false
    // (display-mode is still a browser tab), keeping the menu item visible —
    // and handleInstall takes the manual-instructions path.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("appinstalled"))
    })

    await openMenu(page)
    await page.getByRole("menuitem", { name: "Install Remindit" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // Two close triggers exist (footer "Close" + icon X with aria-label
    // "Close") — pick the footer one by text.
    await dialog
      .locator('[data-slot="dialog-close-trigger"]')
      .filter({ hasText: "Close" })
      .click()
    await expect(dialog).toBeHidden({ timeout: 3000 })
  })
})
