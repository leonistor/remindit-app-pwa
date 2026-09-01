import { expect, type Locator, test } from "@playwright/test"
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

// Seeded theme is light, so every resolved variant must be the light file.
async function expectLightScenarioSrcs(videos: Locator) {
  const srcs = await videos.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute("src") ?? "")
  )
  expect([...srcs].sort()).toEqual(
    EXPECTED_SCENARIOS.map((scenario) => `/demos/${scenario}-light.mp4`).sort()
  )
}

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
    //
    // `autoplay` is part of DemoVideo's normal-path contract (manual=false).
    // Whether muted autoplay actually succeeds or the browser rejects play()
    // (404 in CI without the generated artifacts) is environment-dependent —
    // the rejected-play fallback flips `controls` on, so `controls` is NOT
    // asserted here; that path has its own reduced-motion test below.
    const videos = page.locator("video")
    await expect(videos).toHaveCount(5)

    for (const video of await videos.all()) {
      await expect(video).toHaveAttribute("autoplay", "")
    }
    await expectLightScenarioSrcs(videos)
  })

  // The deterministic fallback path: reduced motion sets `manual` at mount,
  // so every embed renders native controls and skips autoplay — regardless
  // of whether the environment's autoplay policy would block play().
  test("reduced motion: demo videos fall back to native controls without autoplay", async ({
    page,
  }) => {
    // The context-level `reducedMotion` option is not honored in this setup
    // (matchMedia still reports no-preference), so emulate on the page before
    // the app mounts — useAutoplayInView reads matchMedia at first render.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/help")

    const videos = page.locator("video")
    await expect(videos).toHaveCount(5)

    for (const video of await videos.all()) {
      await expect(video).toHaveAttribute("controls", "")
      await expect(video).not.toHaveAttribute("autoplay")
    }
    await expectLightScenarioSrcs(videos)
  })
})
