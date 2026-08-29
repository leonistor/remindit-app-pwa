import { expect, type Page, test } from "@playwright/test"

async function waitForControllingServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg?.active) return false
    return navigator.serviceWorker.controller !== null
  })
}

test("app shell loads while offline (production precache)", async ({
  page,
  context,
}) => {
  await page.goto("/")
  await waitForControllingServiceWorker(page)

  // Give the SW a moment to settle precaching.
  await page.waitForTimeout(1_500)

  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.locator("#root *").first()).toBeAttached()
  } finally {
    await context.setOffline(false)
  }
})

test("deep-linked route resolves offline via navigateFallback", async ({
  page,
  context,
}) => {
  await page.goto("/")
  await waitForControllingServiceWorker(page)

  // Give the SW a moment to settle precaching.
  await page.waitForTimeout(1_500)

  await context.setOffline(true)
  try {
    // A never-visited route must resolve to the cached app shell instead of a
    // browser error page.
    await page.goto("/catalog")
    await expect(page.locator("#root *").first()).toBeAttached()
  } finally {
    await context.setOffline(false)
  }
})
