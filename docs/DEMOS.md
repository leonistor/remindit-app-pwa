# Demo videos

Generates the numbered feature-demo video set shown below. The videos ship as
app static assets (`public/demos/`) so they can be referenced from app content
(Onboarding, Help page) and inspected manually. The Help page embeds scenarios
01/03/04/05/06 inline (via the `DemoVideo` component, `src/components/demo-video.tsx`),
picking the variant that matches the active theme.

Generator: `scripts/demo-scenarios.ts` — Playwright (library API) +
[`playwright-recorder-plus`](https://www.npmjs.com/package/playwright-recorder-plus)
(CDP screencast → ffmpeg two-pass encode). Run it with **Bun** (`import.meta.dir`
resolves natively; `tsx` doesn't).

## Usage

```sh
bun run dev            # dev server on :3000 must be running; the script
                       # exits with instructions if it isn't
bun run demos          # both theme variants (16 files)
bun run demos -- dark  # single variant (the arg is passed through to the script)
```

Outputs to `public/demos/`:

- `{scenario}-{light|dark}.mp4` — served by the app at `/demos/…` and copied
  into `dist/` on build. The `.mp4` files are git-ignored (regenerable
  artifacts); commit only if a release should pin them.
- `preview.html` (tracked) — manual review grid; open the file directly or at
  `/demos/preview.html` via the dev server.

The mp4s are **not** PWA-precached: the Workbox `generateSw` defaults only
precache `{js,css,html}`, so the videos stay runtime-cacheable static assets
and don't inflate the offline precache tested by `test:e2e:prod`.

## Scenario set

One chronological user journey per variant — state carries through
`localStorage` between scenarios (onboarding seeds the catalog used later).
Order mirrors what a real user does:

| # | Scenario | Shows | ~Len |
|---|----------|-------|------|
| 00 | welcome | **Dedicated onboarding step-1 embed (not in Help):** steady start → 2 catalog chips (eggs, milk) onto the empty list; prepare onboards unrecorded so the take opens settled | 7s |
| 01 | onboarding | Welcome card (embeds 00) → Next, dice-roll profile (**Jane Doe**), Minimal dataset, Finish | 16s |
| 02 | install-banner | Mocked `beforeinstallprompt` → banner → "Maybe later" | 4s |
| 03 | add-items | Snacks accordion → 4 catalog chips onto the list | 8s |
| 04 | quick-add | Header-`+` dialog: pick existing "Milk", create "apple" → fridge via category pill | 10s |
| 05 | theme | Menu → Theme → flip to the opposite theme → back to the variant's base | 8s |
| 06 | edit-catalog | `/catalog`: add "Honey" → rename → swipe-delete with confirm | 18s |
| 07 | install | `appinstalled` mock → menu "Install Remindit" → manual instructions dialog | 6s |

Total ≈ 1 min per variant. Scenario steps and exact selectors live in the
script itself (`scripts/demo-scenarios.ts` — each block is commented with the
gotchas that shaped it). Help embeds `01/03/04/05/06` via `DemoVideo`; the
onboarding welcome card embeds only `00` (hardcoded light variant), so `00` is
deliberately calmer than the Help demos and `01`/`03` stay Help-only.

## Architecture decisions

- **Fresh `attachRecorder` per video.** `recorder.start()` after `stop()` is a
  no-op; new instances per scenario are the clean path. Each file gets its own
  two-pass ffmpeg encode — no post-splitting.
- **One page per variant, sequential scenarios.** State carries naturally; no
  resets between videos. A fresh browser context per variant isolates theme
  seeding (the theme is written to `localStorage["remindit:theme"]` via
  `addInitScript` before the app boots and re-applied on every navigation, so
  scenario 01's `localStorage.clear()` can't lose it).
- **`prepare`/`run` split per scenario.** `prepare` (navigation + settling)
  runs before the recorder attaches; `run` is the recorded take.
- **Window size is a constant** (`DEMO_WIDTH`/`DEMO_HEIGHT` = 400×720 in the
  script header). Headed mode is deliberate — it exercises the real window
  manager. No CLI params for size; edit the constants instead.
- **The script never starts its own server.** It targets `BASE` = dev server
  on :3000 and exits early with instructions if nothing answers.

## Gotchas (each one cost a debugging session — don't rediscover them)

**Recording pipeline**

- **Attach the recorder after the app settles** (`prepare`). Attaching early
  races the window-manager resize: the first screencast frame can arrive with
  the pre-viewport size (`400x257`) and the recorder's one-shot size
  validation rejects it.
- **`--force-device-scale-factor=1` launch arg.** On a Retina host the headful
  window's backing buffer is 2× the CSS viewport while the emulated
  `deviceScaleFactor: 1` page paints only into its top-left — the recorder
  scales the whole buffer down and app content ends up quarter-size in the
  first quadrant of the video. Intermittent: it depends on which display the
  window lands on.
- **Viewport height ≥720.** Shorter (e.g. 700) triggers the CDP frame
  mismatch (`server delivered 400x257`) → blank video.
- **Screencast delivers frames only on compositor damage**, and the recorder
  pads frame gaps by repeating the last received frame. A long main-thread
  task (the synchronous onboarding seeding) can leave a *white* frame as that
  last frame, which then fills every subsequent idle pause — a multi-second
  blank stretch. Fix: a 2px infinitely-animating overlay (injected with the
  cursor) keeps compositor frames flowing so gaps never form.
- **`ffmpeg` needs the output dir to exist** before the recorder writes its
  intermediate file.
- **Screencast doesn't capture the system cursor.** The script injects a 28px
  red/white DOM dot via `addInitScript`. Init scripts run at document-start
  when `document.body` is still `null` — mount overlays in a
  `DOMContentLoaded` handler or they silently never appear.

**Humanized input** (all delays randomized; the pointer position is tracked
locally since Playwright doesn't expose it)

- `think(min, max)` — randomized "thinking" pauses between actions.
- `humanMove` — two-leg arced path with jittered midpoint, step density
  scaling with distance.
- `humanClick` — aims in the middle ~40% of the element, arcs over, holds the
  press ~60–130ms. Calls `scrollIntoViewIfNeeded()` first: raw-coordinate
  clicks don't auto-scroll, so below-the-fold targets would otherwise be
  clicked at stale off-screen coordinates.
- `humanClick(…, { direct: true })` — no arc, for menu items: zag menus close
  when the pointer leaves their bounds, so an arc that exits a submenu strands
  the click on the page behind it (silently — the click "works", just not on
  the menu).
- `humanType(…, { replace: true })` — per-char cadence; replace mode selects
  existing text AFTER the focus click (the click collapses an earlier
  select-all).
- `humanSwipeLeft` — CDP `Input.dispatchTouchEvent`: `SwipeableItemRow` sets
  `trackMouse: false`, so mouse drags are ignored by the swipe rows.

**App-side gotchas baked into the scenarios**

- Quick-add category pills are one-tap **create-and-close** actions
  (`handleCategoryPillSelect`); the separate `Add “x”` listbox row is the
  Enter-key path. Curly quotes `“”` are part of the exact labels.
- Menu nav links render as `role="menuitem"`, not `link` (Zag
  `MenuItem asChild` overrides the anchor role).
- The install flows need mocked events: `beforeinstallprompt` (banner, scenario
  02) and `appinstalled` (clears the handler's captured event so scenario 07
  gets the manual instructions instead of the invisible native prompt).
- Substring strict-mode traps: "Add item" matches every per-category button
  (`exact: true`), "Close" matches footer + icon X triggers (filter by text),
  and the item-dialog labels lack `htmlFor` — use
  `getByPlaceholder("e.g. Milk")` there.

## Relation to the e2e suites

No interference, by construction:

- The generator uses the **`playwright` library API** and never reads
  `playwright.config.ts` / `playwright.prod.config.ts` (test-runner-only).
- Ports are disjoint: demos target **:3000** (your dev server); the e2e suites
  self-host on **:5180**/**:5181** with `reuseExistingServer: false`.
- Videos in `public/demos/` don't enter the service-worker precache (Workbox
  `generateSw` defaults to `{js,css,html}`), so `test:e2e:prod` offline
  assertions are unaffected.

## Release flow

Regenerate before a release so shipped videos match the current UI — see
[`.opencode/commands/release.md`](../.opencode/commands/release.md)
("generate demo videos" step).
