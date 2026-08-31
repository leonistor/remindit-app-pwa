/// <reference types="node" />
import { type ChildProcess, spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { type Browser, chromium, devices, type Page } from "@playwright/test"

const PORT = 5182
const BASE_URL = `http://127.0.0.1:${PORT}`
// README image is 550x1196 (~440x956 @1.25x); "mobile-screenshot-*" keep that
// aspect so the README <img width="300"> scales cleanly.
const README_OUTPUT: Record<"light" | "dark", string> = {
  light: "public/mobile-screenshot-light.png",
  dark: "public/mobile-screenshot-dark.png",
}
// Existing iPhone 17 Pro Max logical resolution; Playwright's bundled descriptor
// reports an incorrect 440x763, so we pin it explicitly.
const MOBILE_VIEWPORT = { width: 440, height: 956 }
const DESKTOP_VIEWPORT = { width: 1280, height: 720 }
const MIN_ITEMS = 5
const MAX_ITEMS = 7

type Theme = "light" | "dark"

// Deterministic when SCREENSHOT_SEED is set, otherwise a fresh random pick.
function makeRng(seed?: string): () => number {
  if (!seed) return Math.random
  let state = 0
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0
  }
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Preview server did not become ready at ${url}`)
}

function startPreviewServer(): ChildProcess {
  const proc = spawn(
    "bunx",
    ["rsbuild", "preview", "--port", String(PORT), "--host", "127.0.0.1"],
    { stdio: "inherit" }
  )
  proc.on("error", (err: Error) => {
    throw new Error(`Failed to start preview server: ${err.message}`)
  })
  return proc
}

// Capture the current page to every output path (same pixels, multiple names).
async function capture(page: Page, outputs: string[]) {
  const buffer = await page.screenshot()
  for (const path of outputs) {
    mkdirSync(path.split("/").slice(0, -1).join("/") || ".", {
      recursive: true,
    })
    writeFileSync(path, buffer)
    console.log(`  -> ${path}`)
  }
}

async function completeOnboarding(page: Page) {
  const usernameInput = page.locator("#username")
  // Fresh installs open on the welcome step (video + Next); the profile
  // fields only render after advancing past it. No markers at all means the
  // app is already onboarded.
  if (!(await usernameInput.count())) {
    const welcomeNext = page.getByRole("button", { name: "Next" })
    if (!(await welcomeNext.count())) return
    await welcomeNext.click()
  }
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLInputElement>("#username")
      return el !== null && !el.disabled
    },
    { timeout: 30_000 }
  )
  await page.fill("#firstName", "Demo")
  await page.fill("#lastName", "User")
  await page.fill("#username", "demo")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByRole("button", { name: "Finish" }).click()
  await page.waitForURL((url) => url.pathname === "/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)
}

// Build a realistic list so the shopping screen and History page have content.
async function seedList(page: Page, rng: () => number) {
  const itemButtons = page.locator(
    '[data-testid="catalog-item"]:not([data-selected="true"])'
  )
  await itemButtons.first().waitFor({ state: "visible", timeout: 30_000 })
  await page.waitForTimeout(800)
  const selectedCount = () =>
    page.locator('[data-testid="shopping-item"]').count()
  const target = MIN_ITEMS + Math.floor(rng() * (MAX_ITEMS - MIN_ITEMS + 1))
  let added = 0
  for (let attempt = 0; added < target && attempt < target * 4; attempt++) {
    const count = await itemButtons.count()
    if (count === 0) break
    const before = await selectedCount()
    const i = Math.floor(rng() * count)
    await itemButtons
      .nth(i)
      .click({ timeout: 8_000 })
      .catch(() => {})
    await page.waitForTimeout(200)
    if ((await selectedCount()) > before) added++
  }
  return added
}

async function runProfile(browser: Browser, theme: Theme, isMobile: boolean) {
  const context = await browser.newContext({
    ...(isMobile ? devices["iPhone 17 Pro Max"] : {}),
    viewport: isMobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
    baseURL: BASE_URL,
    deviceScaleFactor: isMobile ? 3 : 1,
    isMobile,
    hasTouch: isMobile,
    colorScheme: theme,
  })
  const page = await context.newPage()
  const rng = makeRng(process.env.SCREENSHOT_SEED)

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await completeOnboarding(page)
  const added = await seedList(page, rng)

  const dir = isMobile ? "mobile" : "desktop"
  const size = isMobile ? "1320x2868" : "1280x720"
  console.log(`${dir} (${theme}): seeded ${added} items @ ${size}`)

  if (isMobile) {
    // List — also feed the README images (mobile-screenshot-*) from this shot.
    await capture(page, [
      `public/screenshot-${dir}-list-${theme}.png`,
      README_OUTPUT[theme],
    ])
    // Catalog (mobile only does light to stay within the 8-shot cap)
    if (theme === "light") {
      await page.goto("/catalog")
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(400)
      await capture(page, [`public/screenshot-${dir}-catalog-${theme}.png`])
    }
    // Profile (mobile only does light to stay within the 8-shot cap)
    if (theme === "light") {
      await page.goto("/profile")
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(400)
      await capture(page, [`public/screenshot-${dir}-profile-${theme}.png`])
    }
  } else {
    for (const [path, name] of [
      ["/", "list"],
      ["/catalog", "catalog"],
      ["/profile", "profile"],
      ["/history", "history"],
    ] as const) {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(400)
      await capture(page, [`public/screenshot-${dir}-${name}-${theme}.png`])
    }
  }

  await page.close()
  await context.close()
}

async function main() {
  const server = startPreviewServer()
  let browser: Browser | undefined
  try {
    await waitForServer(BASE_URL)
    browser = await chromium.launch()
    await runProfile(browser, "light", true)
    await runProfile(browser, "dark", true)
    await runProfile(browser, "light", false)
  } finally {
    await browser?.close()
    server.kill("SIGTERM")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
