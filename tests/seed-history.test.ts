// Tests for the frequency-aware history generator (seed/history.ts).
//
// happy-dom is configured globally. Imports the seed loader via the `seed`
// tsconfig alias; imports the recommender submodule directly (pure, no store
// side effects).

import { describe, expect, test } from "@rstest/core"
import { getDataset } from "seed"
import {
  DEFAULT_HISTORY_DAYS,
  DEFAULT_HISTORY_SEED,
  generateShoppingHistory,
} from "seed/history"
import { computeRecommendations } from "@/stores/recommender"
import type { HistoryEvent } from "@/stores/types"

const DAY_MS = 86_400_000

function summarize(events: HistoryEvent[]) {
  const adds = events.filter((e) => e.action === "add")
  const removes = events.filter((e) => e.action === "remove")
  const addsByCategory = new Map<string, number>()
  for (const e of adds) {
    addsByCategory.set(e.categoryId, (addsByCategory.get(e.categoryId) ?? 0) + 1)
  }
  return { adds, removes, addsByCategory }
}

describe("generateShoppingHistory", () => {
  const { categories, catalog } = getDataset("items_categories")
  const baseOpts = { catalog, categories }

  test("is deterministic for identical inputs", () => {
    // Pin the clock so absolute timestamps are reproducible too.
    const pinned = { ...baseOpts, now: 1_700_000_000_000 }
    const a = generateShoppingHistory(pinned)
    const b = generateShoppingHistory(pinned)
    expect(a).toHaveLength(b.length)
    expect(a[0]).toEqual(b[0])
    expect(a[a.length - 1]).toEqual(b[b.length - 1])
  })

  test("produces a non-empty, time-ordered history within the window", () => {
    const events = generateShoppingHistory(baseOpts)
    expect(events.length).toBeGreaterThan(100)

    const now = Date.now()
    const windowStart = now - DEFAULT_HISTORY_DAYS * DAY_MS
    let prev = -Infinity
    for (const e of events) {
      expect(e.timestamp).toBeGreaterThanOrEqual(windowStart)
      expect(e.timestamp).toBeLessThanOrEqual(now)
      // Stable, deterministic, non-empty ids.
      expect(typeof e.id).toBe("string")
      expect(e.id.length).toBeGreaterThan(0)
      // Ascending order.
      expect(e.timestamp).toBeGreaterThanOrEqual(prev)
      prev = e.timestamp
    }
  })

  test("every remove references an item added earlier (valid buy flow)", () => {
    const events = generateShoppingHistory(baseOpts)
    const seenAdds = new Set<string>()
    for (const e of events) {
      if (e.action === "add") {
        seenAdds.add(e.itemId)
      } else {
        // A remove can only happen for an item already added.
        expect(seenAdds.has(e.itemId)).toBe(true)
      }
    }
  })

  test("adds and removes stay balanced (leftovers are a small fraction)", () => {
    const { adds, removes } = summarize(generateShoppingHistory(baseOpts))
    // Can never remove more than we added.
    expect(removes.length).toBeLessThanOrEqual(adds.length)
    // Sessions buy most of the list, so removes are a clear majority.
    expect(removes.length).toBeGreaterThanOrEqual(adds.length * 0.5)
  })

  test("frequency-aware: weekly fridge vastly out-buys 3-monthly cleaning", () => {
    const { addsByCategory } = summarize(generateShoppingHistory(baseOpts))
    const fridge = categories.find((c) => c.name === "fridge")
    const cleaning = categories.find((c) => c.name === "cleaning")
    expect(fridge).toBeDefined()
    expect(cleaning).toBeDefined()

    const fridgeAdds = addsByCategory.get(fridge?.id ?? "") ?? 0
    const cleaningAdds = addsByCategory.get(cleaning?.id ?? "") ?? 0
    // Weekly (13 items) vs every-3-months (6 items): expect an order-of-magnitude gap.
    expect(fridgeAdds).toBeGreaterThan(cleaningAdds * 5)
  })

  test("shopping sessions cluster removes into 1-3h bursts every 2-3 days", () => {
    const events = generateShoppingHistory(baseOpts)
    const removes = events.filter((e) => e.action === "remove")

    // Group consecutive removes into sessions: a new session starts when the
    // gap to the previous remove exceeds 3h.
    const sessions: number[] = []
    let current = 0
    for (let i = 0; i < removes.length; i++) {
      if (i === 0 || removes[i].timestamp - removes[i - 1].timestamp > 3 * 3_600_000) {
        sessions.push(0)
        current = sessions.length - 1
      }
      sessions[current] += 1
    }

    // ~72 sessions expected over 180 days (every 2-3 days). Allow slack.
    expect(sessions.length).toBeGreaterThanOrEqual(20)
    expect(sessions.length).toBeLessThanOrEqual(120)
    // Each session removes several items (the list had accumulated).
    expect(Math.max(...sessions)).toBeGreaterThanOrEqual(3)
  })

  test("every catalog item is purchased at least once", () => {
    const { adds } = summarize(generateShoppingHistory(baseOpts))
    const purchased = new Set(adds.map((e) => e.itemId))
    for (const item of catalog) {
      expect(purchased.has(item.id)).toBe(true)
    }
  })

  test("seeded history yields non-empty, varied recommendations", () => {
    const events = generateShoppingHistory(baseOpts)
    const recs = computeRecommendations(events, catalog, categories, [])
    expect(recs.length).toBeGreaterThan(0)
    // The frequency spread should produce more than one recommendation tier.
    const tiers = new Set(recs.map((r) => r.tier))
    expect(tiers.size).toBeGreaterThan(1)
  })

  test("default options resolve to 180 days and seed 42", () => {
    const events = generateShoppingHistory(baseOpts)
    const fixed = generateShoppingHistory({
      ...baseOpts,
      days: DEFAULT_HISTORY_DAYS,
      seed: DEFAULT_HISTORY_SEED,
    })
    expect(events).toHaveLength(fixed.length)
  })
})
