import path from "node:path"
import { chromium, type Locator, type Page } from "playwright"
import { attachRecorder } from "playwright-recorder-plus"

// Generates the numbered demo-video set into public/demos/ — one video per
// feature per theme variant (light + dark), recorded as a single chronological
// user journey (state carries through localStorage between scenarios). The
// output folder is served by the app, so the videos can be referenced from app
// content (e.g. /demos/01-onboarding-light.mp4). Docs: docs/DEMOS.md.

// --- Recording window constants ---------------------------------------------
// 400x720: mobile-ish portrait that fits the whole UI. Do not change the
// height to <720 — shorter viewports trigger a CDP screencast frame mismatch
// (server delivers e.g. 400x257) that the recorder rejects. Keep
// --force-device-scale-factor=1 in the launch args below when resizing; see
// docs/DEMOS.md §Gotchas for why.
const DEMO_WIDTH = 400
const DEMO_HEIGHT = 720
const DEMO_VIEWPORT = { width: DEMO_WIDTH, height: DEMO_HEIGHT }

// Videos land in public/demos so the built app serves them as static assets.
const OUT_DIR = path.join(import.meta.dir, "..", "public", "demos")
const BASE = "http://localhost:3000"

type Theme = "light" | "dark"
// Optional CLI filter: `bun scripts/demo-scenarios.ts dark` records only the
// dark variant; default records both.
const variantArg = process.argv[2]
const variants: Theme[] =
  variantArg === "dark" || variantArg === "light"
    ? [variantArg]
    : ["light", "dark"]

// The generator drives the app on the dev server (headed). It intentionally
// does NOT start its own server: rsbuild dev on :3000 (or an equivalent) must
// already be running.
let baseAlive: Response | undefined
try {
  baseAlive = await fetch(BASE)
} catch {
  // handled below
}
if (!baseAlive?.ok) {
  console.error(
    `No dev server responding at ${BASE}. Start it first:\n\n  bun run dev\n`
  )
  process.exit(1)
}

const browser = await chromium.launch({
  headless: false,
  args: ["--force-device-scale-factor=1"],
})

// Reassigned per variant — the humanized helpers operate on the live page.
let context: Awaited<ReturnType<typeof browser.newContext>>
let page: Page

// --- Humanized input (see docs/demo-recording-plan.md) ----------------------
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const think = (min: number, max: number) => page.waitForTimeout(rand(min, max))

let cursor = { x: 0, y: 0 }

async function humanMove(x: number, y: number) {
  const distance = Math.hypot(x - cursor.x, y - cursor.y)
  const midX = (cursor.x + x) / 2 + rand(-40, 40)
  const midY = (cursor.y + y) / 2 + rand(-40, 40)
  const steps = Math.max(6, Math.round(distance / rand(10, 18)))
  await page.mouse.move(midX, midY, { steps: Math.ceil(steps / 2) })
  await page.mouse.move(x, y, { steps: Math.ceil(steps / 2) })
  cursor = { x, y }
  await page.waitForTimeout(rand(40, 120))
}

async function humanClick(locator: Locator, opts: { direct?: boolean } = {}) {
  // locator.click() auto-scrolls; raw-coordinate clicks don't. Without this,
  // targets below the fold get clicked at stale off-screen coordinates.
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`click target not visible: ${locator}`)
  const x = box.x + box.width * rand(0.3, 0.7)
  const y = box.y + box.height * rand(0.3, 0.7)
  if (opts.direct) {
    // Hover-sensitive containers (zag menus close when the pointer wanders
    // outside them) — move straight to the target, no arc waypoint.
    const steps = Math.max(
      4,
      Math.round(Math.hypot(x - cursor.x, y - cursor.y) / 14)
    )
    await page.mouse.move(x, y, { steps })
  } else {
    await humanMove(x, y)
  }
  cursor = { x, y }
  await page.mouse.down()
  await page.waitForTimeout(rand(60, 130))
  await page.mouse.up()
}

/** Click into the field like a human, then type with per-char cadence. */
async function humanType(
  locator: Locator,
  text: string,
  opts: { replace?: boolean } = {}
) {
  await humanClick(locator)
  if (opts.replace) {
    // Select existing content AFTER the focus click (clicking would collapse
    // an earlier selection) so typing overwrites it.
    await page.keyboard.press("ControlOrMeta+A")
  }
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: rand(60, 160) })
    // Occasional longer hesitation between keystrokes.
    if (Math.random() < 0.15) await page.waitForTimeout(rand(120, 350))
  }
}

/**
 * Swipe-left gesture on an element (mobile row delete). The swipe rows listen
 * to touch only (`trackMouse: false` in SwipeableItemRow), so this dispatches
 * raw touch events via CDP — a mouse drag would be ignored.
 */
async function humanSwipeLeft(locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`swipe target not visible: ${locator}`)
  const y = box.y + box.height / 2
  const startX = box.x + box.width * 0.8
  const endX = box.x + box.width * 0.1
  const cdp = await context.newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y }],
  })
  // A flick with fingers: fast, slightly non-linear.
  const midX = (startX + endX) / 2
  const steps = [
    [midX, y + rand(-6, 6)],
    [endX, y],
  ] as const
  for (const [x, py] of steps) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: py }],
    })
    await page.waitForTimeout(rand(25, 60))
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
}

// Menu chrome is shared by several scenarios.
const openMenu = async () => {
  await humanClick(page.getByRole("button", { name: "Open menu" }))
  await think(300, 600)
}

interface Scenario {
  file: string
  /** Unrecorded prep (navigation, settling) — runs before the recorder attaches. */
  prepare?: (page: Page) => Promise<void>
  /** The recorded take. `theme` is the variant's base theme. */
  run: (page: Page, theme: Theme) => Promise<void>
}

const scenarios: Scenario[] = [
  // --- 00 — dedicated onboarding welcome preview ------------------------------
  // Embedded (autoplaying, looping) in the onboarding step-1 card — NOT in
  // Help. Designed for that small embed: a steady opening beat (no motion),
  // then two deliberate catalog-chip taps into the still-empty list. Its
  // prepare performs a real (unrecorded) onboarding so the take starts on a
  // settled main view — the mount animations are gone before the recorder
  // attaches, so the embed never opens with "the app animating in".
  {
    file: "00-welcome",
    prepare: async (p) => {
      await p.goto(BASE)
      // One-time wipe for a genuine first run (same pattern as scenario 01;
      // 01 re-wipes and re-onboards right after this, so no state leaks).
      await p.evaluate(() => localStorage.clear())
      await p.goto(BASE)
      // Unrecorded click-through of the real onboarding (no dice rolls).
      // Language step (first) and welcome step each carry a single Next
      // footer button — the default resolved locale (English) needs no
      // interaction to advance.
      await p.getByRole("button", { name: "Next" }).click() // language → welcome
      await p.getByRole("button", { name: "Next" }).click() // welcome → profile
      // Step 3's Next stays disabled while the profile generates — wait for
      // the username value before advancing.
      await p.getByLabel("Username").waitFor({ state: "visible" })
      await p.waitForFunction(
        () =>
          (document.querySelector<HTMLInputElement>("#username")?.value ?? "")
            .length > 0
      )
      await p.getByRole("button", { name: "Next" }).click()
      await p
        .getByRole("radio", { name: "Minimal (starter)" })
        .waitFor({ state: "visible", timeout: 5000 })
      await p.getByRole("button", { name: "Finish" }).click()
      await p
        .getByText("Tap items below to add to the shopping list.")
        .waitFor()
    },
    run: async (p) => {
      await think(1400, 2000)
      // Both targets live in the two default-open groups (cooking/fridge);
      // scope to catalog chips — after adding, the same name also exists in
      // the list panel and getByRole alone would multi-match.
      const chip = (name: string) =>
        p
          .getByRole("button", { name })
          .and(p.locator('[data-testid="catalog-item"]'))
      await humanClick(chip("eggs"))
      await think(900, 1500)
      await humanClick(chip("milk"))
      await think(900, 1500)
      await think(1000, 1600)
    },
  },

  // --- 01 — onboarding ------------------------------------------------------
  {
    file: "01-onboarding",
    prepare: async (p) => {
      await p.goto(BASE)
      // One-time wipe for a genuine first run. Done via evaluate + reload
      // rather than addInitScript, which would wipe state on EVERY load.
      await p.evaluate(() => localStorage.clear())
      await p.goto(BASE)
      // First-run lands on the language step (English/Română picker + Next);
      // the welcome video and profile dice only appear after advancing.
      await p
        .getByRole("button", { name: "Next" })
        .waitFor({ state: "visible", timeout: 15_000 })
    },
    run: async (p) => {
      // Language step (new first step): tap the already-active English —
      // setAppLocale's same-locale guard makes it a no-op (no reload) —
      // then advance to the welcome step.
      await think(1200, 1800)
      await humanClick(p.getByRole("button", { name: "English" }))
      await think(500, 900)
      await humanClick(p.getByRole("button", { name: "Next" }))
      // Let the welcome video play for a beat, then advance to the profile.
      await think(1600, 2400)
      await humanClick(p.getByRole("button", { name: "Next" }))
      await think(600, 1100)
      const dice = p.getByRole("button", {
        name: "Roll a new random name and avatar",
      })
      await think(600, 1200)
      for (let i = 0; i < 3; i++) {
        await humanClick(dice)
        await think(700, 1400)
      }
      await humanType(p.getByLabel("First name"), "Jane")
      await think(300, 700)
      await humanType(p.getByLabel("Last name"), "Doe")
      await think(400, 900)
      await humanClick(p.getByRole("button", { name: "Next" }))
      await think(600, 1100)
      await humanClick(p.getByRole("radio", { name: "Minimal (starter)" }))
      await think(400, 800)
      await humanClick(p.getByRole("button", { name: "Finish" }))
      await p
        .getByText("Tap items below to add to the shopping list.")
        .waitFor()
      await think(600, 1000)
    },
  },

  // --- 02 — install banner --------------------------------------------------
  {
    file: "02-install-banner",
    run: async (p) => {
      // No real beforeinstallprompt in a Playwright context — dispatch a mock.
      // pwa-install-handler's window listener persists post-load.
      await p.evaluate(() => {
        const e = new Event("beforeinstallprompt", { cancelable: true })
        const mock = e as Event & {
          prompt: () => Promise<void>
          userChoice: Promise<{ outcome: string; platform: string }>
        }
        mock.prompt = async () => {}
        mock.userChoice = Promise.resolve({
          outcome: "accepted",
          platform: "web",
        })
        window.dispatchEvent(mock)
      })
      const later = p.getByRole("button", { name: "Maybe later" })
      // Banner has a built-in 1.5s mount delay after canInstall flips.
      await later.waitFor({ state: "visible", timeout: 6000 })
      await think(900, 1600)
      await humanClick(later)
      await later.waitFor({ state: "detached", timeout: 3000 })
      await think(500, 900)
    },
  },

  // --- 03 — add items to shopping list --------------------------------------
  {
    file: "03-add-items",
    // Fragility note: the catalog accordion opens the FIRST TWO category
    // groups by default (item-catalog.tsx) — with the current dataset that is
    // cooking + fridge (both rank "weekly"; the stable sort keeps dataset
    // order). eggs/pasta (cooking) and yogurt (fridge) are therefore already
    // visible; the snacks trigger click opens the remaining group for
    // crackers. A dataset edit that reshuffles the ranking or moves these
    // items silently breaks this scenario.
    run: async (p) => {
      await humanClick(p.getByRole("button", { name: /snacks/i }))
      await think(500, 1000)
      // Scope to catalog chips: after adding, the same item name also exists
      // in the list panel and getByRole alone would multi-match.
      for (const item of ["eggs", "pasta", "yogurt", "crackers"]) {
        const chip = p
          .getByRole("button", { name: item })
          .and(p.locator('[data-testid="catalog-item"]'))
        await humanClick(chip)
        await think(500, 1200)
      }
      await think(600, 1000)
    },
  },

  // --- 04 — quick add ---------------------------------------------------------
  {
    file: "04-quick-add",
    run: async (p) => {
      const plus = p.getByRole("button", { name: "Add to shopping list" })
      const input = p.getByPlaceholder("Add an item…")
      const done = p.getByRole("button", { name: "Done", exact: true })

      // Existing item via autocomplete.
      await humanClick(plus)
      await input.waitFor({ state: "visible", timeout: 3000 })
      await think(400, 800)
      await humanType(input, "milk")
      await think(300, 600)
      await humanClick(p.getByRole("option", { name: "Milk" }))
      await done.waitFor({ state: "detached", timeout: 3000 })
      await think(600, 1100)

      // New item: type a novel name, then one-tap create via the category
      // pill — the pill IS the create action (creates + closes the dialog).
      // (The "Add “apple”" row is an ordinary autocomplete option — click or
      // keyboard-select; the Enter-on-input path is separate and creates the
      // typed value under the selected category pill.)
      await humanClick(plus)
      await input.waitFor({ state: "visible", timeout: 3000 })
      await think(400, 800)
      await humanType(input, "apple")
      await think(300, 600)
      // Curly quotes are part of the exact label format.
      await humanClick(p.getByRole("button", { name: "Add “apple” to Fridge" }))
      await done.waitFor({ state: "detached", timeout: 3000 })
      await think(600, 1000)
    },
  },

  // --- 05 — theme selection ---------------------------------------------------
  {
    file: "05-theme",
    // The demo flip: show the OPPOSITE of the variant's base theme, then
    // return to it — so every other video in the set keeps the variant's look
    // (light set stays light, dark set stays dark).
    run: async (p, theme) => {
      const flipTo = theme === "light" ? "Dark" : "Light"
      const backTo = theme === "light" ? "Light" : "Dark"
      await openMenu()
      await humanClick(p.getByRole("menuitem", { name: "Theme" }), {
        direct: true,
      })
      await think(400, 700)
      // Submenu radios: direct click — the arc's waypoint can exit the
      // submenu bounds, which closes the menu and strands the click on the
      // page behind it.
      await humanClick(p.getByRole("menuitemradio", { name: flipTo }), {
        direct: true,
      })
      await think(900, 1500)

      await openMenu()
      await humanClick(p.getByRole("menuitem", { name: "Theme" }), {
        direct: true,
      })
      await think(400, 700)
      await humanClick(p.getByRole("menuitemradio", { name: backTo }), {
        direct: true,
      })
      await think(700, 1200)
      // Close the menu if the radio select kept it open.
      const closeMenu = p.getByRole("button", { name: "Close menu" })
      if (await closeMenu.isVisible().catch(() => false)) {
        await humanClick(closeMenu)
      }
      await think(400, 800)
    },
  },

  // --- 06 — edit catalog --------------------------------------------------------
  {
    file: "06-edit-catalog",
    // 400px viewport = mobile layout: rows are tap-to-edit, swipe-to-delete.
    run: async (p) => {
      await openMenu()
      // Menu nav links render as menuitem (Zag MenuItem asChild overrides the
      // anchor's implicit link role) — not getByRole("link").
      await humanClick(p.getByRole("menuitem", { name: "Catalog" }), {
        direct: true,
      })
      await p.getByRole("heading", { name: "Catalog" }).waitFor({
        timeout: 5000,
      })
      await think(600, 1100)

      // Add "Honey" to Fridge. exact:true — "Add item" also substring-matches
      // every per-category "Add item to {name}" button.
      await humanClick(p.getByRole("button", { name: "Add item", exact: true }))
      const dialog = p.getByRole("dialog")
      await dialog.waitFor({ state: "visible", timeout: 3000 })
      await think(400, 800)
      // The placeholder is used for robustness/simplicity — not because
      // labels are broken: Ark Field auto-associates label and control (no
      // manual htmlFor needed), so getByLabel works here too.
      await humanType(dialog.getByPlaceholder("e.g. Milk"), "Honey")
      await think(300, 600)
      await humanClick(dialog.locator('[data-slot="select-trigger"]'))
      await think(300, 600)
      await humanClick(p.getByRole("option", { name: "Fridge" }))
      await think(300, 600)
      await humanClick(dialog.getByRole("button", { name: "Add", exact: true }))
      await dialog.waitFor({ state: "detached", timeout: 3000 })
      await think(700, 1200)

      // Rename via tap-to-edit (mobile verb).
      const row = p.getByRole("button", { name: /Edit Honey/ })
      await row.waitFor({ state: "visible", timeout: 3000 })
      await humanClick(row)
      const editDialog = p.getByRole("dialog")
      await editDialog.waitFor({ state: "visible", timeout: 3000 })
      await think(400, 700)
      const nameInput = editDialog.getByPlaceholder("e.g. Milk")
      await nameInput.waitFor({ state: "visible", timeout: 3000 })
      await humanType(nameInput, "Raw Honey", { replace: true })
      await humanClick(
        editDialog.getByRole("button", { name: "Save", exact: true })
      )
      await editDialog.waitFor({ state: "detached", timeout: 3000 })
      await think(700, 1100)

      // Delete via swipe-left → revealed Delete button → confirm dialog.
      const renamedRow = p.getByRole("button", { name: /Edit Raw Honey/ })
      await renamedRow.waitFor({ state: "visible", timeout: 3000 })
      await humanSwipeLeft(renamedRow)
      await think(300, 600)
      await humanClick(p.getByRole("button", { name: "Delete Raw Honey" }))
      const confirm = p.getByRole("alertdialog")
      await confirm.waitFor({ state: "visible", timeout: 3000 })
      await think(400, 800)
      await humanClick(confirm.getByRole("button", { name: "Delete item" }))
      await confirm.waitFor({ state: "detached", timeout: 3000 })
      await think(600, 1000)

      // Back to the main view for the next scenario. (The list has items at
      // this point, so wait for chrome that's always visible, not the
      // empty-state text.)
      // "Back" (m.back()) — the label changed in the paraglide i18n migration.
      await humanClick(p.getByRole("button", { name: "Back" }))
      await p
        .getByRole("button", { name: "Add to shopping list" })
        .waitFor({ timeout: 5000 })
      await think(400, 800)
    },
  },

  // --- 07 — install instructions ----------------------------------------------
  {
    file: "07-install",
    run: async (p) => {
      // Retire the captured beforeinstallprompt (simulates the app having
      // been installed at OS level): pwa-install-handler clears its event on
      // "appinstalled", so canInstall flips false. $installed stays false
      // (display-mode is still a browser tab), keeping the menu item visible
      // — and handleInstall then takes the manual-instructions path instead
      // of the invisible native prompt.
      await p.evaluate(() => {
        window.dispatchEvent(new Event("appinstalled"))
      })
      await think(500, 900)
      await openMenu()
      await humanClick(p.getByRole("menuitem", { name: "Install Remindit" }), {
        direct: true,
      })
      const dialog = p.getByRole("dialog")
      await dialog.waitFor({ state: "visible", timeout: 3000 })
      await think(1200, 2000)
      // Two close triggers exist (footer "Close" + icon X with aria-label
      // "Close") — pick the footer one by text.
      await humanClick(
        dialog
          .locator('[data-slot="dialog-close-trigger"]')
          .filter({ hasText: "Close" })
      )
      await dialog.waitFor({ state: "detached", timeout: 3000 })
      await think(500, 900)
    },
  },
]

// --- Runner -------------------------------------------------------------------
// One fresh context per theme variant: the theme is seeded before the app's
// first paint (init script re-applies it on every navigation, so scenario 01's
// localStorage wipe can't lose it) and scenario 05 flips back to it.
for (const variant of variants) {
  context = await browser.newContext({
    viewport: DEMO_VIEWPORT,
    deviceScaleFactor: 1,
  })
  page = await context.newPage()

  await page.addInitScript((theme) => {
    localStorage.setItem("remindit:theme", JSON.stringify(theme))
  }, variant)

  // Cursor overlay + screencast keep-alive. Injected before the first
  // navigation; they persist for the whole session. See
  // docs/demo-recording-script.md for why both are needed.
  await page.addInitScript(() => {
    const mount = () => {
      const dot = document.createElement("div")
      Object.assign(dot.style, {
        position: "fixed",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: "rgba(220, 38, 38, 0.7)",
        border: "3px solid rgba(255, 255, 255, 0.9)",
        pointerEvents: "none",
        zIndex: "2147483647",
        transform: "translate(-50%, -50%)",
        transition: "left 0.05s, top 0.05s",
      })
      document.addEventListener(
        "mousemove",
        (e) => {
          dot.style.left = `${e.clientX}px`
          dot.style.top = `${e.clientY}px`
        },
        { passive: true }
      )
      document.body.appendChild(dot)

      const keepalive = document.createElement("div")
      Object.assign(keepalive.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "2px",
        height: "2px",
        pointerEvents: "none",
        zIndex: "2147483647",
        background: "#fff",
      })
      keepalive.animate(
        [{ opacity: "1" }, { opacity: "0.99" }, { opacity: "1" }],
        { duration: 1000, iterations: Infinity }
      )
      document.body.appendChild(keepalive)
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true })
    } else {
      mount()
    }
  })

  let current: Awaited<ReturnType<typeof attachRecorder>> | undefined
  try {
    for (const scenario of scenarios) {
      // Settle before attaching: the recorder's one-shot size validation
      // races the window resize if the first screencast frame arrives too
      // early.
      await scenario.prepare?.(page)
      current = await attachRecorder(page, {
        path: path.join(OUT_DIR, `${scenario.file}-${variant}.mp4`),
      })
      await scenario.run(page, variant)
      await current.stop()
      current = undefined
      console.log(`✓ ${scenario.file}-${variant}.mp4`)
    }
  } finally {
    if (current) {
      await current.stop().catch(() => {})
      await current.finalized.catch(() => {})
    }
    await context.close()
  }
}
await browser.close()
