// Generated shopping-history fixture + seed-data builder for store tests.
//
// Design notes:
// - IDs are DERIVED deterministically from the source row (category name +
//   item name) via a stable string hash, so integration tests can rely on the
//   same category/item IDs that `generateShoppingHistory` produced. This is
//   deliberate: the app's own seeder (`src/stores/index.ts`) uses
//   `crypto.randomUUID()`, which would make cross-store assertions flaky.
// - The category/item id scheme and the sample rows now come from the shared
//   `seed` loader (`seed/index.ts`): the duplicated FNV-1a `hashId` and the
//   per-row `categoryIdFor`/`itemIdFor` helpers previously lived here and have
//   been removed. `hashId` is byte-identical to the old local helper, so the
//   generated ids are unchanged.
// - Event generation is seeded (mulberry32), so a given {days, seed, count}
//   always yields the same add/remove structure and ordering. Absolute
//   timestamps are anchored to `Date.now()` (history is "the past N days"),
//   but remain monotonically ascending and within the requested window.

import type {
  Category,
  CatalogItem,
  HistoryAction,
  HistoryEvent,
} from "@/stores/types"
import { rawItems, categories, catalog, hashId, type RawSeedItem } from "seed"

const DAY_MS = 86_400_000

const sampleItems = rawItems as RawSeedItem[]

interface ResolvedItem {
  itemId: string
  itemName: string
  categoryId: string
}

// Map a raw seed row to its deterministic fixture ids using the shared
// `hashId` from the seed loader (byte-identical to the old local helper).
function resolveRow(row: RawSeedItem): ResolvedItem {
  return {
    itemId: hashId(`item::${row.category_name}::${row.name}`),
    itemName: row.name,
    categoryId: hashId(`cat::${row.category_name}`),
  }
}

// Mulberry32: tiny, fast, seedable PRNG. Returns floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface GenerateHistoryOptions {
  days?: number
  seed?: number
  count?: number
}

const DEFAULT_DAYS = 90
const DEFAULT_SEED = 1
const DEFAULT_COUNT = 200
// Bias toward 'add' so we always have something to remove, and so that
// realistic buy/remove pairs form (an item is only removed after it was
// added). Net effect: more adds than removes.
const ADD_PROBABILITY = 0.62

export function generateShoppingHistory(
  opts: GenerateHistoryOptions = {}
): HistoryEvent[] {
  const days = opts.days ?? DEFAULT_DAYS
  const seed = opts.seed ?? DEFAULT_SEED
  const count = opts.count ?? DEFAULT_COUNT

  const rng = mulberry32(seed)
  const now = Date.now()
  const range = days * DAY_MS
  const start = now - range

  const events: HistoryEvent[] = []
  // Items currently "in the cart" (added but not yet removed). Removing always
  // targets a previously-added item, guaranteeing add→remove ordering.
  const owned: ResolvedItem[] = []

  for (let i = 0; i < count; i++) {
    const doAdd = owned.length === 0 || rng() < ADD_PROBABILITY
    let resolved: ResolvedItem
    let action: HistoryAction

    if (doAdd) {
      const row = sampleItems[Math.floor(rng() * sampleItems.length)]
      resolved = resolveRow(row)
      owned.push(resolved)
      action = "add"
    } else {
      const idx = Math.floor(rng() * owned.length)
      resolved = owned[idx]
      owned.splice(idx, 1)
      action = "remove"
    }

    // Ascending timestamps: each event lands after the previous one, spread
    // evenly across the window with a little jitter.
    const base = start + ((i + 1) / count) * range
    const jitter = Math.floor(rng() * (range / count))
    const timestamp = Math.min(base + jitter, now)

    events.push({
      id: hashId(`evt::${seed}::${i}`),
      action,
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      categoryId: resolved.categoryId,
      timestamp,
    })
  }

  return events
}

// Static 3-month history for direct import in tests that don't need tuning.
export const shoppingHistory3mo = generateShoppingHistory({
  days: 90,
  seed: 1,
})

export default shoppingHistory3mo

// Builds a consistent {categories, catalog, history} trio from the shared seed
// loader. IDs match those used by `generateShoppingHistory`, so a test can
// populate the stores with `buildSeedData()` and then assert against the same
// history.
export function buildSeedData(): {
  categories: Category[]
  catalog: CatalogItem[]
  history: HistoryEvent[]
} {
  return {
    categories,
    catalog,
    history: generateShoppingHistory({ days: 90, seed: 1 }),
  }
}
