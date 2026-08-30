import type { Page } from "@playwright/test"

// `$onboarded` is a `jsonStore<boolean>` persisted under `remindit:onboarded`
// (values are JSON-encoded, so the stored string is "true"). The router redirects
// un-onboarded users to /onboarding (src/router.tsx), so e2e specs that target the
// main app views must seed it before the app boots.
export async function onboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("remindit:onboarded", "true")
  })
}
