// Generates seed/palettes.json — the pool of categorical color palettes that
// back user-colorizable categories (Phase 3).
//
// Each palette is seeded from a d3 categorical scheme (decoded verbatim from
// the d3 `main` source so the anchors are authoritative) and extended to exactly
// 12 colors. The extension uses a *greedy OKLab midpoint* algorithm: we never
// move the original d3 anchors — we only insert new colors into the largest
// perceptual gaps between consecutive colors (wrapping around). This keeps the
// palette's character intact while reaching the 12-color target and maximizing
// separation between neighboring hues.
//
// Run with: `bun run generate:palettes`.

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import chroma from "chroma-js"

const DEFAULT_PALETTE_ID = "paired"
const TARGET_COLOR_COUNT = 12

interface SeedPalette {
  id: string
  name: string
  source: string
  description: string
  colors: string[]
}

// d3 categorical schemes, decoded from the d3 source files (RGB hex strings).
// Category 10 / Dark 2 / Observable 10 are shorter than 12 and get extended;
// Paired / Set 3 already have 12 and are kept as-is.
const SEED_PALETTES: SeedPalette[] = [
  {
    id: "category10",
    name: "Fast and Furious",
    source: "d3 schemeCategory10",
    description: "Based on d3 schemeCategory10",
    colors: [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ],
  },
  {
    id: "dark2",
    name: "Why so serious?",
    source: "d3 schemeDark2",
    description: "Based on d3 schemeDark2",
    colors: [
      "#1b9e77",
      "#d95f02",
      "#7570b3",
      "#e7298a",
      "#66a61e",
      "#e6ab02",
      "#a6761d",
      "#666666",
    ],
  },
  {
    id: "observable10",
    name: "New York",
    source: "d3 schemeObservable10",
    description: "Based on d3 schemeObservable10",
    colors: [
      "#4269d0",
      "#efb118",
      "#ff725c",
      "#6cc5b0",
      "#3ca951",
      "#ff8ab7",
      "#a463f2",
      "#97bbf5",
      "#9c6b4e",
      "#9498a0",
    ],
  },
  {
    id: "paired",
    name: "Van Gogh",
    source: "d3 schemePaired",
    description: "Based on d3 schemePaired",
    colors: [
      "#a6cee3",
      "#1f78b4",
      "#b2df8a",
      "#33a02c",
      "#fb9a99",
      "#e31a1c",
      "#fdbf6f",
      "#ff7f00",
      "#cab2d6",
      "#6a3d9a",
      "#ffff99",
      "#b15928",
    ],
  },
  {
    id: "set3",
    name: "Claude Monet",
    source: "d3 schemeSet3",
    description: "Based on d3 schemeSet3",
    colors: [
      "#8dd3c7",
      "#ffffb3",
      "#bebada",
      "#fb8072",
      "#80b1d3",
      "#fdb462",
      "#b3de69",
      "#fccde5",
      "#d9d9d9",
      "#bc80bd",
      "#ccebc5",
      "#ffed6f",
    ],
  },
]

// Perceptual distance (CIEDE2000) between two hex colors. Used to pick the
// widest gap to split next; larger = more visually distinct.
function perceptualDistance(a: string, b: string): number {
  return chroma.deltaE(a, b)
}

// Human-readable label for a color, derived from its HSL position. chroma's
// `.name()` only matches a small CSS list and falls back to the raw hex for
// interpolated colors, so we map the hue wheel to friendly words instead.
// Returns values like "blue", "light green", "brown", "dark red", "gray".
function colorName(hex: string): string {
  const [h, s, l] = chroma(hex).hsl()
  if (h === null || Number.isNaN(h) || s < 0.12) {
    if (l > 0.85) return "white"
    if (l < 0.18) return "black"
    return "gray"
  }
  const sectors: [number, string][] = [
    [15, "red"],
    [45, "orange"],
    [70, "yellow"],
    [95, "lime"],
    [150, "green"],
    [185, "teal"],
    [210, "cyan"],
    [240, "blue"],
    [270, "indigo"],
    [300, "purple"],
    [330, "magenta"],
    [360, "red"],
  ]
  let base = "gray"
  for (const [max, name] of sectors) {
    if (h <= max) {
      base = name
      break
    }
  }
  // Warm, dark hues read as brown rather than "dark orange".
  if ((base === "orange" || base === "yellow" || base === "red") && l < 0.45) {
    base = "brown"
  }
  const qual = l > 0.68 ? "light " : l < 0.38 ? "dark " : ""
  return (qual + base).trim()
}

// Greedily insert OKLab-midpoint colors into the widest consecutive gaps until
// the palette reaches `target` colors. Original anchors are never reordered or
// altered — only new entries are inserted between them.
function extendToTarget(colors: string[], target: number): string[] {
  const out = [...colors]
  while (out.length < target) {
    let bestIndex = 0
    let bestDistance = -1
    for (let i = 0; i < out.length; i++) {
      const next = (i + 1) % out.length
      const d = perceptualDistance(out[i], out[next])
      if (d > bestDistance) {
        bestDistance = d
        bestIndex = i
      }
    }
    const mid = chroma
      .mix(out[bestIndex], out[(bestIndex + 1) % out.length], 0.5, "oklab")
      .hex()
    out.splice(bestIndex + 1, 0, mid)
  }
  return out
}

interface PaletteColor {
  hex: string
  name: string
}

interface Palette {
  id: string
  name: string
  source: string
  description: string
  colors: PaletteColor[]
}

interface PalettePool {
  defaultPaletteId: string
  palettes: Palette[]
}

function buildPool(): PalettePool {
  const palettes: Palette[] = SEED_PALETTES.map((seed) => {
    const extended = extendToTarget(seed.colors, TARGET_COLOR_COUNT)
    return {
      id: seed.id,
      name: seed.name,
      source: seed.source,
      description: seed.description,
      colors: extended.map((hex) => ({
        hex: chroma(hex).hex(),
        name: colorName(chroma(hex).hex()),
      })),
    }
  })

  return {
    defaultPaletteId: DEFAULT_PALETTE_ID,
    palettes,
  }
}

const pool = buildPool()
const outPath = join(import.meta.dir, "..", "seed", "palettes.json")
const json = JSON.stringify(pool, null, 2)
writeFileSync(outPath, `${json}\n`, "utf8")

// Echo a quick sanity summary to the console.
for (const p of pool.palettes) {
  console.log(`${p.id}: ${p.colors.length} colors (${p.source})`)
}
console.log(`\nWrote ${pool.palettes.length} palettes to ${outPath}`)
