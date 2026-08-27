/// <reference types="node" />
import { type ChildProcess, spawn } from "node:child_process"
import {
  type Browser,
  type BrowserContext,
  chromium,
  devices,
} from "@playwright/test"

const PORT = 5182
const BASE_URL = `http://127.0.0.1:${PORT}`
const OUTPUT_PATH = "public/mobile-screenshot.png"
// Existing README image is 550x1196 (~440x956 @1.25x); we keep the same aspect
// so the `width="300"` README img scales cleanly.
const DEVICE = devices["iPhone 17 Pro Max"]
// Real iPhone 17 Pro Max logical resolution; Playwright's bundled descriptor
// reports an incorrect 440x763, so we pin it explicitly.
const VIEWPORT = { width: 440, height: 956 }
const MIN_ITEMS = 5
const MAX_ITEMS = 7

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

async function generateScreenshot(context: BrowserContext) {
  const page = await context.newPage()
  const rng = makeRng(process.env.SCREENSHOT_SEED)

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  // Unselected catalog chips carry data-testid="catalog-item" with
  // data-selected="false"; they are the only clickable add targets.
  const itemButtons = page.locator(
    '[data-testid="catalog-item"]:not([data-selected="true"])'
  )
  await itemButtons.first().waitFor({ state: "visible", timeout: 30_000 })
  // Let React finish hydrating so the chips are actually interactive.
  await page.waitForTimeout(800)

  // Add 5-7 random items by driving off the live selected count rather than
  // fixed positions — the layout reflows as items are added, so positional
  // clicks are flaky. Retry a different chip if a click doesn't register.
  // Shopping-list chips expose a stable data-testid="shopping-item".
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

  // Capture the full device viewport (the README <img> already applies the
  // rounded-corner frame via inline CSS).
  await page.screenshot({ path: OUTPUT_PATH })
  console.log(
    `Captured ${added} random items -> ${OUTPUT_PATH} (${VIEWPORT.width}x${VIEWPORT.height} @${DEVICE.deviceScaleFactor}x)`
  )
  await page.close()
}

async function main() {
  const server = startPreviewServer()
  let browser: Browser | undefined
  try {
    await waitForServer(BASE_URL)
    browser = await chromium.launch()
    const context = await browser.newContext({
      ...DEVICE,
      // Pin the real iPhone 17 Pro Max logical size; Playwright's bundled
      // descriptor reports an incorrect 440x763 viewport.
      viewport: VIEWPORT,
      baseURL: BASE_URL,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
    await generateScreenshot(context)
  } finally {
    await browser?.close()
    server.kill("SIGTERM")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
