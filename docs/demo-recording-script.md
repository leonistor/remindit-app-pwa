# Demo Recording Script

Helper script for generating feature demo videos using Playwright + `playwright-recorder-plus`.

> Multi-video scenario set (onboarding → install, 7 numbered videos) is planned in
> [`demo-recording-plan.md`](./demo-recording-plan.md) — the implementation spec for
> `scripts/demo-scenarios.ts`.

## Files

- `scripts/demo-avatar-roll.ts` — recording script
- `scripts/demo-avatar-roll.mp4` — generated video (git-ignored)
- `scripts/demo-preview.html` — static HTML page to preview generated videos

## Running

Dev server must be running on port 3000:

```sh
bun run dev &
bun scripts/demo-avatar-roll.ts
```

Preview at `scripts/demo-preview.html` (open directly in browser, no server needed).

## Dependencies

- `playwright` (peer dep for `playwright-recorder-plus`)
- `playwright-recorder-plus` — high-quality video recording via CDP screencast + ffmpeg two-pass pipeline

Install: `bun add -D playwright-recorder-plus playwright`

## Key findings

### Runtime

Use **Bun**, not `bunx tsx`. `import.meta.dir` resolves natively in Bun; `tsx` (Node) doesn't support it.

**Attach the recorder after the app has settled** (post-`goto`, post first-content wait). Attaching immediately after `newPage()` races the window-manager resize: the first screencast frame can arrive while the headful window still has its pre-viewport size (`400x257`) and the recorder's one-shot size validation rejects it. Side benefit: the blank page-load lead-in stays out of the video.

### Viewport & video size

- **Viewport:** 400×720 (headless:false, deviceScaleFactor:1)
- 720 height is required — 700 causes a CDP frame mismatch (`server delivered 400x257, expected 400x700`) which produces a blank video
- The `size` option on `attachRecorder` defaults to `page.viewportSize()` — no need to set it explicitly
- **Launch with `--force-device-scale-factor=1`.** On a Retina host the headful window's backing buffer is 800×1440 physical while the emulated `deviceScaleFactor: 1` viewport paints only into its top-left 400×720 — the recorder then scales the buffer down and the app content ends up quarter-size in the first quadrant of the video. Which display the window lands on varies per launch, so this appears intermittently without the flag.

### Humanized input

The scenario avoids `locator.click()` (teleports the pointer, fixed delays) in favor of small helpers in the script:

- **`think(min, max)`** — randomized "thinking" pause between actions (dice rolls ~0.7–1.4s while "evaluating" the avatar, item picks ~0.5–1.2s, etc.).
- **`humanMove(x, y)`** — two-leg arced path (jittered midpoint) instead of a straight teleport; step density scales with distance (~10–18px/step); small settle pause on arrival.
- **`humanClick(locator)`** — aims inside the middle ~40% of the element (humans don't hit dead-center), arcs over, then holds the press ~60–130ms before releasing.

The pointer position is tracked locally (`cursor`) because Playwright doesn't expose the live pointer location. All ranges are `Math.random`-based — every run of the same scenario produces a slightly different rhythm.

### Cursor overlay

Playwright's screencast does **not** capture the system cursor. The script injects a DOM-based cursor dot via `page.addInitScript()`: a 28px circle, red fill at 70% opacity (pops against category chips) with a 3px near-solid white ring (visible on white backgrounds). Init scripts run at document-start, when `document.body` is still `null`, so the dot must be mounted in a `DOMContentLoaded` handler (or after a `readyState` check) — appending directly throws silently and the overlay never appears.

### Install banner

The PWA install banner (`src/components/install-banner.tsx`) depends on `usePwaInstall().showBanner`. It may not appear in a Playwright context (no PWA install prompt available). The script wraps the "No" button click in a try/catch with a 3s timeout to handle this gracefully.

### Blank stretches mid-video (screencast keep-alive)

CDP screencast delivers frames **only on compositor damage**. Idle periods (waits, no interaction) produce no frames at all, and `playwright-recorder-plus` pads frame gaps by repeating the *last received* frame (`ingestFrame`). That turns two failure modes into visible blank stretches:

1. A long main-thread task (e.g. the synchronous onboarding seeding after **Finish**) invalidates the content raster — the compositor delivers 1–3 **white frames** (only independently-composited layers like the cursor dot still draw). The white frame becomes the recorder's `_lastJpeg`.
2. The next idle pause (e.g. the 3s install-banner wait) is padded by repeating that white frame → multi-second blank stretch.

**Fix:** inject a 2px infinitely-animating overlay (`element.animate` opacity pulse) in the same init script as the cursor dot. Continuous compositor damage keeps frames flowing through idle pauses, so gaps never form and `_lastJpeg` is always real content. Worst case remains a <100ms blink during the seeding block itself — acceptable.

### Onboarding selectors

| Step | Selector | File |
|------|----------|------|
| Dice roll | `getByRole("button", { name: "Roll a new random name and avatar" })` | `src/views/onboarding.tsx:90` |
| Next | `getByRole("button", { name: "Next" })` | `src/views/onboarding.tsx:170` |
| Finish | `getByRole("button", { name: "Finish" })` | `src/views/onboarding.tsx:183` |
| Install No | `getByRole("button", { name: "No" })` | `src/components/install-banner.tsx:40` |

### Catalog selectors

| Element | Selector | File |
|---------|----------|------|
| Category accordion | `getByRole("button", { name: "<category>" })` (case-insensitive) | `src/components/item-catalog.tsx:33` |
| Catalog item | `getByRole("button", { name: "<item>" })` or `[data-testid="catalog-item"]` | `src/components/ui/custom/item-button.tsx:95` |

## TODO

- [x] Fix cursor overlay visibility in recordings (defer mount to `DOMContentLoaded`)
- [ ] Add more demo scenarios (different features)
- [x] Add `scripts/demo-*.mp4` to `.gitignore`
