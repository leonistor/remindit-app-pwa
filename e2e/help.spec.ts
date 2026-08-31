import { expect, test } from "@playwright/test"
import { openMenu, seedTheme } from "./demo-helpers"
import { onboard } from "./helpers"

// The five scenarios DemoVideo embeds on the Help page (docs/DEMOS.md).
const EXPECTED_SCENARIOS = [
  "01-onboarding",
  "03-add-items",
  "04-quick-add",
  "05-theme",
  "06-edit-catalog",
]

test.describe("Help page", () => {
  // The app gates on onboarding, so seed the onboarded flag before every test.
  test.beforeEach(async ({ page }) => {
    await onboard(page)
    // onboard() alone leaves the theme on "system", which resolves from the
    // browser's OS preference — seed light so the video-variant assertions
    // below are deterministic (same trick as e2e/demo-helpers.ts).
    seedTheme(page, "light")
  })

  test("navigates from the menu and embeds the five theme-matched demo videos", async ({
    page,
  }) => {
    await page.goto("/")

    // Cover the menu's Help link instead of deep-linking /help directly.
    await openMenu(page)
    await page
      .locator('[data-slot="menu-content"]')
      .locator("a")
      .getByText("Help", { exact: true })
      .click()

    await expect(page).toHaveURL(/\/help$/)
    await expect(
      page.getByRole("heading", { name: "Help", level: 1 })
    ).toBeVisible()

    // Element/attribute assertions only: the mp4s are git-ignored artifacts,
    // so playback isn't asserted — existence of the right sources is.
    const videos = page.locator("video")
    await expect(videos).toHaveCount(5)

    for (const video of await videos.all()) {
      await expect(video).toHaveAttribute("controls", "")
      const src = await video.getAttribute("src")
      // Seeded theme is light, so the resolved variant must be the light file.
      expect(src).toMatch(
        new RegExp(`^/demos/(${EXPECTED_SCENARIOS.join("|")})-light\\.mp4$`)
      )
    }

    // All five scenarios are embedded, each exactly once (DOM order differs
    // from scenario order — sort before comparing the full set).
    const srcs = await videos.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("src") ?? "")
    )
    expect([...srcs].sort()).toEqual(
      EXPECTED_SCENARIOS.map(
        (scenario) => `/demos/${scenario}-light.mp4`
      ).sort()
    )
  })
})
