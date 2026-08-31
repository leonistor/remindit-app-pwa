# Demo Recording Script

Helper script for generating feature demo videos using Playwright + `playwright-recorder-plus`.

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

### Viewport & video size

- **Viewport:** 400×720 (headless:false, deviceScaleFactor:1)
- 720 height is required — 700 causes a CDP frame mismatch (`server delivered 400x257, expected 400x700`) which produces a blank video
- The `size` option on `attachRecorder` defaults to `page.viewportSize()` — no need to set it explicitly

### Cursor overlay

Playwright's screencast does **not** capture the system cursor. The script injects a DOM-based cursor dot via `page.addInitScript()`. **This does not currently work** — the overlay isn't visible in the recording. Needs investigation (possibly the init script runs too late, or the screencast captures before the overlay mounts).

### Install banner

The PWA install banner (`src/components/install-banner.tsx`) depends on `usePwaInstall().showBanner`. It may not appear in a Playwright context (no PWA install prompt available). The script wraps the "No" button click in a try/catch with a 3s timeout to handle this gracefully.

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

- [ ] Fix cursor overlay visibility in recordings
- [ ] Add more demo scenarios (different features)
- [ ] Consider adding `scripts/demo-*.mp4` to `.gitignore`
