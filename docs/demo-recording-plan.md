# Demo Recording Plan — scenario set

> Implementation spec for `scripts/demo-scenarios.ts`. Companion to
> [`demo-recording-script.md`](./demo-recording-script.md) (single-recording findings: keep-alive,
> cursor overlay, size races — all still apply). This doc is the cross-session source of truth for
> the multi-video set; update it when scenarios change.

## Goal

One script, one browser journey per theme variant, producing a numbered set of
feature videos in `scripts/demos/` — **each video in a light and a dark
variant** (`{file}-{light|dark}.mp4`; 14 files total):

| # | File (suffix `-light`/`-dark`) | Feature | ~Len | Exit state |
|---|------|---------|------|------------|
| 01 | `01-onboarding` | First-run profile + dataset | 12s | Onboarded as **Jane Doe**, Minimal catalog, seeded history |
| 02 | `02-install-banner` | PWA install banner | 4s | Banner dismissed via "Maybe later" (session-only) |
| 03 | `03-add-items` | Catalog → shopping list | 8s | 4 chips on list (eggs, pasta, yogurt, crackers) |
| 04 | `04-quick-add` | Quick add dialog | 10s | +Milk (existing) +Apple→fridge (new) |
| 05 | `05-theme` | Theme picker | 8s | Flip to the OPPOSITE theme → back to the variant's base |
| 06 | `06-edit-catalog` | Catalog CRUD | 18s | Catalog unchanged (add → rename → delete) |
| 07 | `07-install` | Install instructions dialog | 6s | Dialog opened & closed, not installed |

**Theme variants:** the runner loops over `["light", "dark"]` (CLI filter:
`bun scripts/demo-scenarios.ts dark`). Each variant gets a fresh browser
context; the theme is seeded via `addInitScript` writing
`localStorage["remindit:theme"]` before the app boots — re-applied on every
navigation, so scenario 01's localStorage wipe can't lose it. Scenario 05's
flip mirrors per variant (light set: Dark→Light; dark set: Light→Dark) so
every other video keeps the variant's look.

Numbering = chronological user journey. The install banner lands at **02**
(not 07) because it appears ~1.5s after onboarding completes — that's when a
real user first sees it. "Maybe later" (not "Install") keeps `canInstall` true
so the menu-based install flow stays available for 07.

## Architecture decisions

- **Fresh `attachRecorder` per video.** `recorder.start()` after `stop()` is a
  no-op (verified in `playwright-recorder-plus` dist) — reuse is impossible,
  new instances are the clean path. Each video gets its own two-pass ffmpeg
  encode; no post-splitting.
- **One page, sequential scenarios.** State carries naturally through
  localStorage (onboarding → data → UI prefs) — mirrors a real user journey.
  No resets between videos.
- **Shared humanized helpers** (`think`, `humanMove`, `humanClick`,
  `humanType`) — see `demo-recording-script.md` §Humanized input.
  `humanType` is new: per-char delay 60–160ms via `page.keyboard`.
- **Attach the recorder after the scenario's first content is visible** —
  avoids the `400x257` pre-resize frame race (size validation is per-recorder,
  so every video needs the settle-before-attach treatment).
- **Cursor + keep-alive overlays** inject once via `addInitScript` before the
  first `goto` (they survive for the whole session).
- **The `beforeinstallprompt` mock is NOT global** — dispatch per-scenario via
  `page.evaluate` where needed (02). The `pwa-install-handler` listener
  persists post-load, so late dispatch works.

## Scenario steps

Selectors below are verified against the source (file:line in the research
notes; ask for the selector map if lost). Playwright `getByRole` names are
substring + case-insensitive by default.

### 01 — onboarding

Start: fresh `localStorage` (cleared once before first `goto`, NOT via
`addInitScript` — that would wipe state on every navigation).

1. `goto /` → redirected to `/onboarding`
2. Beat; roll avatar ×2–3 (`aria-label="Roll a new random name and avatar"`,
   disabled while generating), pause ~0.7–1.4s between rolls
3. `humanType` "Jane" → First name; "Doe" → Last name
   (`getByLabel` works — these inputs have `htmlFor`)
4. Click **Next** → step 2 of 2
5. Radiogroup "Seed dataset": click radio **"Minimal (starter)"** (already
   selected — click anyway for the visual)
6. Click **Finish** → lands on `/`

### 02 — install banner

Start: onboarded, on `/`. Prereq: `remindit:install-dismissed` unset (fresh ✓),
display-mode not standalone (headful default ✓).

1. `page.evaluate` → dispatch mock `beforeinstallprompt`:
   `const e = new Event("beforeinstallprompt", { cancelable: true })`;
   `e.prompt = async () => {}`;
   `e.userChoice = Promise.resolve({ outcome: "accepted" })`;
   `window.dispatchEvent(e)`
2. Wait ~1.5s (banner has a built-in mount delay) → banner "Install Remindit"
   slides up
3. Beat (read it), then click **"Maybe later"** → banner exits
   (persisted-deny "No" and native-prompt "Install" are alternative takes;
   "Install" would set `$installed` and hide the 07 menu item — don't use)

### 03 — add items

1. Open "Fridge" and "Snacks" accordion triggers (a11y names are UPPERCASE —
   use case-insensitive `getByRole("button", { name: /fridge/i })`)
2. Add via catalog chips: eggs → pasta → yogurt → crackers
   (**scope with `[data-testid="catalog-item"]`** — after adding, the same
   name exists in the list panel)
3. ~0.5–1.2s think between picks

### 04 — quick add

1. Click floating `+` (`aria-label="Add to shopping list"`, top-right of the
   list panel) → "Quick add" dialog
2. Input `placeholder="Add an item…"` is autofocused (~120ms); `humanType`
   "milk" → click `option "Milk"` in the listbox → dialog closes, chip lands
3. Reopen; `humanType` "apple" (create-row needs **≥3 chars**) → click pill
   ``Add “apple” to Fridge`` (curly quotes, exact) — **the category pill IS
   the create action**: it creates the item in that category and closes the
   dialog in one tap (`handleCategoryPillSelect` → `createNewItem`). The
   separate `Add “apple”` listbox row is the Enter-key path; clicking the
   pill then waiting for that row hangs — the dialog is already gone.
4. *Note: ≥10 recommendations flip the option list to recs-only — chosen
   targets are safe either way*

### 05 — theme

1. Hamburger `aria-label="Open menu"` (**flips to "Close menu"** while open)
2. menuitem "Theme" → submenu (lazy-mounted — radio items don't exist until
   open) → `menuitemradio "Dark"` → whole app flips
3. Beat; reopen hamburger → Theme → `menuitemradio "Light"`
4. End on Light so 06 keeps the set's look consistent

### 06 — edit catalog

⚠ 400px viewport = **mobile layout** (`useIsMobile`) — mobile verbs apply.

1. Hamburger → menuitem "Catalog" (lazy route — wait past `Loading…`).
   **Menu nav links are `role="menuitem"`**, not `role="link"` (Zag
   `MenuItem asChild` overrides the anchor's implicit role).
2. "Add item" → dialog: `humanType` "Honey" into
   `getByPlaceholder("e.g. Milk")` — **`getByLabel` is broken here**
   (`ValidatedField` renders labels without `htmlFor`) → pick category via
   `[data-slot="select-trigger"]` → "Add" (**`exact: true`** — "Add item"
   substring-matches every per-category "Add item to {name}" button)
3. Rename: **single click** the row (mobile: "tap to edit", not dblclick) →
   replace-mode typing: click into the field, THEN `ControlOrMeta+A`, then
   type (an earlier select-all is collapsed by humanType's focus click) →
   "Save"
4. Delete: **swipe-left via CDP touch events** — `SwipeableItemRow` sets
   `trackMouse: false`, so mouse drags are ignored; dispatch
   `Input.dispatchTouchEvent` touchStart → touchMove ×2 → touchEnd →
   revealed "Delete" button → AlertDialog → confirm **"Delete item"**
5. Back ("Go back") → wait for the quick-add button (the list is NOT empty
   at this point — the empty-state text never appears)
6. Exit: catalog back to pre-scenario state

### 07 — install

1. `page.evaluate` → dispatch `new Event("appinstalled")` — the
   `pwa-install-handler` clears its captured `beforeinstallprompt`, so
   `canInstall` flips false. **`$installed` stays false** (display-mode is
   still a browser tab), keeping the menu item visible. Without this,
   `handleInstall` takes the native-prompt path (invisible in Playwright)
   and the instructions dialog never opens. (The banner "Install" button is
   NOT an alternative: it sets `$installed` and hides the menu item.)
2. Hamburger → menuitem **"Install Remindit"** → **InstallInstructionsDialog**
   ("Add to your Mac" on desktop UA) → beat
3. Click "Close" — scope by text (`[data-slot="dialog-close-trigger"]` with
   hasText "Close"): the dialog also renders an icon X-trigger with
   `aria-label="Close"` and both match `getByRole("button", { name: "Close" })`

## Conventions & risks

- Curly quotes `“”` and en-dashes `–` appear in several labels — copy exact
  strings from the tables above.
- View/exit animations run 150–200ms; the `think()` beats cover them.
- After adding, an item exists in **two panels** with the same accessible
  name — always scope list vs catalog via `data-testid`.
- `humanType` must click-into the field first when it isn't autofocused; use
  `{ replace: true }` to overwrite existing content (the focus click would
  collapse a select-all made beforehand).
- **`humanClick` calls `scrollIntoViewIfNeeded()` before measuring** — raw
  coordinate clicks don't auto-scroll like `locator.click()`, so below-the-fold
  targets otherwise get clicked at stale off-screen coordinates.
- **Menu items need `{ direct: true }`** — the arc waypoint can exit the
  (sub)menu's bounds; zag closes menus when the pointer leaves them, so the
  click then strands on the page behind it (this silently swallowed the theme
  radio click in the dark variant).
- All delays randomized (`rand(min, max)`) — every run differs; each variant
  set runs ~1 min.

## Workflow

```sh
bun run dev &                      # port 3000
mkdir -p scripts/demos             # ffmpeg needs the output dir to exist
bun scripts/demo-scenarios.ts      # regenerates scripts/demos/*-{light,dark}.mp4
bun scripts/demo-scenarios.ts dark # single variant
```

Preview: open `scripts/demo-preview.html` (untracked, local-only). Verify
after recording: per-frame blank-scan (see demo-recording-script.md) + spot
check cursor visibility.
