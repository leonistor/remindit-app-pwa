import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, type Page, test } from "@playwright/test"
import { catalogChip, openMenu } from "./demo-helpers"
import { onboard } from "./helpers"

// Committed fixture: a minimal valid backup envelope (current app version —
// must NOT trigger the newer-version warning). The distinctive item name is
// asserted on the home screen after restore.
const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "backup.json"
)

// Drive the hidden file input through the real click → native filechooser path.
type PickTarget = string | { name: string; mimeType: string; buffer: Buffer }

async function pickBackupFile(page: Page, file: PickTarget): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Import", exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(file)
}

// Navigate to /profile through the hamburger menu (covers menu navigation and
// lands on the same view a direct URL would).
async function gotoProfileViaMenu(page: Page): Promise<void> {
  await onboard(page)
  await page.goto("/")
  await openMenu(page)
  await page.getByRole("menuitem", { name: "Profile" }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible()
}

test.describe("Profile backup import", () => {
  test("shows an inline error for a non-backup file and never opens the confirm dialog", async ({
    page,
  }) => {
    await gotoProfileViaMenu(page)

    await pickBackupFile(page, {
      name: "garbage.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json"),
    })

    await expect(page.getByRole("alert")).toContainText(
      "That file isn't a valid RemindIt backup."
    )
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("restores a valid backup after confirmation and lands home with the restored catalog", async ({
    page,
  }) => {
    await gotoProfileViaMenu(page)

    await pickBackupFile(page, FIXTURE_PATH)

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("Restore this backup?")
    // Backup version + export date surface in the dialog description.
    await expect(dialog).toContainText(/RemindIt v4\.3\.0 on /)
    // Current-version backup: the newer-version warning must be absent.
    await expect(
      dialog.getByText("created by a newer version of RemindIt")
    ).toHaveCount(0)

    await dialog.getByRole("button", { name: "Replace everything" }).click()

    // Success ack appears first; it auto-navigates home after ~1.5s — no
    // sleep, toHaveURL auto-waits past the ack delay.
    await expect(page.getByRole("dialog")).toContainText("Backup restored")
    await expect(page).toHaveURL(/\/$/)
    // The distinctive catalog item from the fixture shows up in the catalog
    // panel (data-testid scopes it away from the same-named list chip).
    await expect(catalogChip(page, "E2E Backup Saffron")).toBeVisible()
  })

  test("warns when the backup was created by a newer app version", async ({
    page,
  }) => {
    await gotoProfileViaMenu(page)

    // Runtime fixture: same valid envelope, future major version (99 > 4).
    const futureEnvelope = JSON.parse(
      fs.readFileSync(FIXTURE_PATH, "utf8")
    ) as {
      version: string
    }
    futureEnvelope.version = "99.0.0"
    await pickBackupFile(page, {
      name: "future-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(futureEnvelope)),
    })

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/RemindIt v99\.0\.0 on /)
    await expect(dialog).toContainText("created by a newer version of RemindIt")
  })
})
