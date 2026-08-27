# Phase 3 — Categorical color palettes

**Status:** Foundation done (palette pool generated + loader + tests) on branch
`feat/categorical-palettes`. Later sub-phases (color picker, palette chooser) pending.

## Goal

Give users control over category (and therefore item) colors via a pool of
categorical color palettes, instead of the current hardwired, inconsistently
used `src/lib/category-palette.ts` Tailwind-class slots.

## Decisions

- **Pool of 5 palettes**, each padded to **12 colors** (max estimated categories).
  When a data set is initialized, colors are assigned from the chosen palette
  **sequentially** (category N → color `N % 12`).
- **Default palette = `category10`** (the classic d3/Tableau standard).
- **Source palettes** (decoded verbatim from the d3 `main` source so anchors are
  authoritative): `schemeCategory10` (10→12), `schemeDark2` (8→12),
  `schemeObservable10` (10→12), `schemePaired` (12), `schemeSet3` (12).
- **Filler colors** generated with a **greedy OKLab-midpoint** algorithm: the
  original d3 anchors are never moved/reordered; new colors are inserted into the
  widest perceptual gaps until 12 is reached (`scripts/generate-palettes.ts`).
- **Per-color `name`** derived from the HSL hue wheel (no extra dep) — chroma's
  `.name()` only matches a tiny CSS list and falls back to the raw hex.
- **`description`** on every palette = `Generated from
  https://d3js.org/d3-scale-chromatic/categorical` (per request).

## Package evaluation

- **`chroma-js` — installed.** OKLab interpolation for fillers + HSL for names.
- **`ok-palette` — skipped.** Generates full palettes from seed color(s); cannot
  *extend* existing d3 schemes while keeping their anchors.
- **`color-names` — skipped (for now).** `chroma.name()` is insufficient (returns
  hex for misses); the HSL hue-name is dependency-free. Swap in later if richer
  evocative names are wanted for the picker UI.

## Data shape (`seed/palettes.json`)

```json
{
  "defaultPaletteId": "category10",
  "palettes": [
    { "id": "category10", "name": "Category 10", "source": "d3 schemeCategory10",
      "description": "Generated from https://d3js.org/d3-scale-chromatic/categorical",
      "colors": [ { "hex": "#1f77b4", "name": "blue" }, /* …12 */ ] }
  ]
}
```

## Files

- `seed/palettes.json` — the pool (generated artifact, do not hand-edit).
- `scripts/generate-palettes.ts` — reproducible generator (run `bun run generate:palettes`).
- `src/lib/palettes.ts` — typed loader: `PALETTE_POOL`, `getPalette`,
  `defaultPalette`, `assignSequentialColor(index)`.
- `src/lib/palettes.test.ts` — invariant tests (5 palettes, valid default, 12
  distinct hexes each, anchors preserved, sequential wrap, description present).
- `package.json` — added `generate:palettes` script; added `chroma-js` +
  `@types/chroma-js` (dev).

## Next sub-phases (not yet started)

1. **Wire consumers** — replace `category-palette.ts` Tailwind-class usage with
   the hex-based pool (button/badge/dot tokens derived from `PaletteColor.hex`,
   with dark-mode variants). Keep the `overrideSlot` seam → future `Category.color`.
2. **Custom color picker** — when editing a category, let the user override its
   color (persist on `Category`; `getPaletteColor`/override path).
3. **Palette chooser in settings** — pick the active palette (`defaultPaletteId`
   is the seed default; user choice persisted).
