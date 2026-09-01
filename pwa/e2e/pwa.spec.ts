import { expect, type Page, test } from "@playwright/test"

async function waitForActiveServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false
    const reg = await navigator.serviceWorker.getRegistration()
    return !!reg && reg.active !== null
  })
}

test.describe("Remindit PWA (dev mode)", () => {
  test("manifest is linked and served with branding", async ({
    page,
    request,
  }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBeLessThan(400)

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href")
    expect(manifestHref).toBeTruthy()

    const res = await request.get(manifestHref as string)
    expect(res.status()).toBe(200)

    const manifest = (await res.json()) as {
      name: string
      display: string
      theme_color: string
      icons: Array<{ purpose: string }>
    }
    expect(manifest.name).toBe("RemindIt")
    expect(manifest.display).toBe("standalone")
    expect(manifest.theme_color).toBe("#262626")
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "any" }),
        expect.objectContaining({ purpose: "maskable" }),
      ])
    )
  })

  test("icon assets are served", async ({ request }) => {
    for (const icon of ["/remindit-icon.svg", "/remindit-icon-maskable.svg"]) {
      const res = await request.get(icon)
      expect(res.status(), icon).toBe(200)
      expect(res.headers()["content-type"]).toContain("image/svg+xml")
    }
  })

  test("service worker registers and becomes active", async ({ page }) => {
    await page.goto("/")
    await waitForActiveServiceWorker(page)

    const scope = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return reg?.scope ?? ""
    })
    expect(scope).toContain("127.0.0.1:5180")
  })

  test("service worker controls the page after activation", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForActiveServiceWorker(page)

    // On the next navigation the active SW takes control of the client.
    await page.reload()
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null
    )
  })
})
