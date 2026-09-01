import { expect, type Page, test } from "@playwright/test"
import { onboard } from "../e2e/helpers"

async function waitForControllingServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg?.active) return false
    return navigator.serviceWorker.controller !== null
  })
}

// The Workbox precache must actually hold the app shell before an offline boot
// can be trusted: poll the Cache Storage API for the navigateFallback document
// (rsbuild-plugin-pwa's generateSw stores precache entries with a
// __WB_REVISION__ query, so match with ignoreSearch). Replaces the previous
// fixed 1.5s "settle" sleep with a deterministic condition. Dev-mode precache
// only contains the Workbox suppression script, which is fine: this spec runs
// exclusively under playwright.prod.config.ts (production preview).
async function waitForPrecache(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (typeof caches === "undefined") return false
        const keys = await caches.keys()
        if (keys.length === 0) return false
        const shell = await caches.match("/index.html", { ignoreSearch: true })
        return shell !== undefined
      })
    )
    .toBe(true)
}

// Locale-independent shell marker: the round menu logo link (a[href="/"]
// wrapping /remindit-icon.svg) renders only after the React router has mounted
// from the precached bundle, and its accessible surface doesn't depend on the
// active locale (unlike the menu/nav labels). A blank served shell or a
// browser error page fails this assertion.
const shellMarker = (page: Page) =>
  page.locator('a[href="/"] img[src="/remindit-icon.svg"]')

test("app shell loads while offline (production precache)", async ({
  page,
  context,
}) => {
  // Seed the onboarding flag so the offline boot renders the main app shell
  // (a fresh context would be gated to /onboarding, which has no menu chrome).
  await onboard(page)
  await page.goto("/")
  await waitForControllingServiceWorker(page)
  await waitForPrecache(page)

  await context.setOffline(true)
  try {
    await page.reload()
    await expect(shellMarker(page)).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test("deep-linked route resolves offline via navigateFallback", async ({
  page,
  context,
}) => {
  await onboard(page)
  await page.goto("/")
  await waitForControllingServiceWorker(page)
  await waitForPrecache(page)

  await context.setOffline(true)
  try {
    // A never-visited route must resolve to the cached app shell instead of a
    // browser error page. /catalog is a lazy-loaded route and renders the
    // version footer (only shown off-home), so the logo marker plus this
    // footer link prove both the shell and the route chunk came from precache.
    await page.goto("/catalog")
    await expect(shellMarker(page)).toBeVisible()
    await expect(page.locator('a[href="/changelog"]')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
