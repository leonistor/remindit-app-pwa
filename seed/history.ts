// Generates a realistic, reproducible shopping history for first-run seeding.
//
// The simulation is frequency-aware: each item is added on a cadence derived
// from its category frequency (via `FREQ_TO_DAYS`), and "shopping sessions"
// every 2–3 days remove most of the items currently on the list — 0–3 are left
// over, mirroring how a real trip ends with a few things still on the list.
//
// Pure + seeded (mulberry32): a given {catalog, categories, days, seed} always
// yields the same events, so recommendations stay reproducible across runs and
// the generator is trivially unit-testable.

import { FREQ_TO_DAYS } from "@/stores/recommender"
import type {
  CatalogItem,
  Category,
  HistoryAction,
  HistoryEvent,
} from "@/stores/types"
import { hashId } from "./hash"

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export const DEFAULT_HISTORY_DAYS = 180
export const DEFAULT_HISTORY_SEED = 42

export interface GenerateHistoryOptions {
  catalog: CatalogItem[]
  categories: Category[]
  /** Window length in days (default 180 ≈ 6 months). */
  days?: number
  /** PRNG seed for reproducibility (default 42). */
  seed?: number
  /** Reference "now" in ms. Defaults to `Date.now()`; inject for tests/builds. */
  now?: number
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

// Fisher–Yates shuffle using the supplied PRNG (returns a new array).
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Build a frequency-aware 6-month shopping history.
 *
 * @param catalog     Items to simulate purchases for.
 * @param categories  Categories providing each item's `frequency`.
 * @param days        Look-back window (events land in `[now-days, now]`).
 * @param seed        PRNG seed; same seed + inputs → identical output.
 */
export function generateShoppingHistory(
  opts: GenerateHistoryOptions
): HistoryEvent[] {
  const { catalog, categories } = opts
  const days = opts.days ?? DEFAULT_HISTORY_DAYS
  const seed = opts.seed ?? DEFAULT_HISTORY_SEED
  const rng = mulberry32(seed)

  const now = opts.now ?? Date.now()
  const start = now - days * DAY_MS

  const freqByCategory = new Map(categories.map((c) => [c.id, c.frequency]))
  const intervalFor = (item: CatalogItem): number => {
    const freq = freqByCategory.get(item.categoryId) ?? "unknown"
    return FREQ_TO_DAYS[freq] ?? FREQ_TO_DAYS.unknown
  }

  // Per-item next-add day. An initial offset spreads first purchases across the
  // first cycle so not every item is "due" on day 0.
  const nextAddDay = new Map<string, number>()
  for (const item of catalog) {
    nextAddDay.set(item.id, Math.floor(rng() * intervalFor(item)))
  }

  // Items currently on the active list (added, not yet removed).
  const cart = new Map<string, CatalogItem>()
  const events: HistoryEvent[] = []

  // Sessions every 2–3 days, starting a few days in so the cart can populate.
  let nextSessionDay = 2 + Math.floor(rng() * 2)

  const dayStart = (d: number) => start + d * DAY_MS

  for (let d = 0; d < days; d++) {
    // --- Shopping session: remove most of what is on the list. ---
    if (d === nextSessionDay) {
      const sessionStart =
        dayStart(d) + 8 * HOUR_MS + Math.floor(rng() * 12 * HOUR_MS)
      const sessionDuration = (1 + rng() * 2) * HOUR_MS // 1–3h span

      const onList = [...cart.values()]
      const leftover = Math.floor(rng() * 4) // 0–3 stay on the list
      const removeCount = Math.max(0, onList.length - leftover)
      const toRemove = shuffle(onList, rng).slice(0, removeCount)

      let cursor = sessionStart
      for (const item of toRemove) {
        cursor += (rng() * sessionDuration) / Math.max(1, toRemove.length)
        events.push({
          id: "",
          action: "remove" as HistoryAction,
          itemId: item.id,
          itemName: item.name,
          categoryId: item.categoryId,
          timestamp: Math.min(cursor, now),
        })
        cart.delete(item.id)
      }

      nextSessionDay = d + 2 + Math.floor(rng() * 2)
    }

    // --- Daily adds: items that are due and not already on the list. ---
    const due = catalog.filter(
      (item) => d >= (nextAddDay.get(item.id) ?? 0) && !cart.has(item.id)
    )
    // A realistic day sees ~1–10 additions; cap protects the busiest days.
    for (const item of shuffle(due, rng).slice(0, 10)) {
      const timestamp = Math.min(dayStart(d) + Math.floor(rng() * DAY_MS), now)
      events.push({
        id: "",
        action: "add" as HistoryAction,
        itemId: item.id,
        itemName: item.name,
        categoryId: item.categoryId,
        timestamp,
      })
      cart.set(item.id, item)

      const interval = intervalFor(item)
      const jitter = 1 + (rng() - 0.5) * 0.4 // ±20% around the expected cadence
      nextAddDay.set(item.id, d + Math.max(1, Math.round(interval * jitter)))
    }
  }

  // Anything still in the cart at `now` simply has no trailing remove event —
  // the realistic "leftover" outcome. No further action needed.

  events.sort((a, b) => a.timestamp - b.timestamp)

  // Stable, deterministic event ids (reproducible across runs/builds).
  return events.map((event, i) => ({
    ...event,
    id: hashId(`evt::${seed}::${i}`),
  }))
}
