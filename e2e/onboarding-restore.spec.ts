import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, type Page, test } from "@playwright/test"
import { catalogChip } from "./demo-helpers"

// Fresh context on purpose (no onboard() helper): the spec exercises the
// un-onboarded gate and the full onboarding restore path.
const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "backup.json"
)

// Onboarding step 4 UI: the seed-dataset radio group must NEVER appear during
// a restore flow (restore replaces steps 3–4).
const datasetRadios = (page: Page) =>
  page.getByRole("radiogroup", { name: "Seed dataset" })

// Step 2 restore path: click the real "I have a backup file" button (which
// opens the native chooser) and hand it the given file.
async function pickBackupFile(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer }
): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "I have a backup file" }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(file)
}

test.describe("Onboarding restore from backup", () => {
  test("restores a backup at the welcome step and skips the profile and dataset steps", async ({
    page,
  }) => {
    // Fresh storage → the router gate bounces "/" to /onboarding.
    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding$/)

    // Step 1 (language): the default resolved locale is English, so the step
    // completes with Next alone (same pattern as demo-helpers.onboardViaUi).
    await expect(page.getByText("Choose your language")).toBeVisible()
    await expect(datasetRadios(page)).toHaveCount(0)
    await page.getByRole("button", { name: "Next" }).click()

    // Step 2 (welcome): restore from the committed backup fixture.
    await pickBackupFile(page, FIXTURE_PATH)

    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Restore this backup?")
    await dialog.getByRole("button", { name: "Replace everything" }).click()

    // Restore forces $onboarded and navigates home — steps 3 (profile) and
    // 4 (dataset) must never render.
    await expect(page).toHaveURL(/\/$/)
    await expect(catalogChip(page, "E2E Backup Saffron")).toBeVisible()
    await expect(datasetRadios(page)).toHaveCount(0)
    await expect(page.locator('[data-slot="segment-group-item"]')).toHaveCount(
      0
    )
  })

  test("shows an inline error for a non-backup file and stays on onboarding", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/onboarding$/)
    await page.getByRole("button", { name: "Next" }).click()

    await pickBackupFile(page, {
      name: "garbage.json",
      mimeType: "application/json",
      buffer: Buffer.from("<html>definitely not a backup"),
    })

    await expect(page.getByRole("alert")).toContainText(
      "That file isn't a valid RemindIt backup."
    )
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
})
