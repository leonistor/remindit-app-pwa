// Unit tests for the recommendation engine (src/stores/recommender).
//
// Tests cover the pure scoring functions as well as the $recommendations
// computed store. Stores are seeded directly via $store.set() in beforeEach,
// avoiding initStores() side effects.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import {
  computeItemStats,
  computeRecommendations,
  FREQ_TO_DAYS,
  getExpectedInterval,
  scoreItem,
} from "@/stores/recommender"
import { $recommendations } from "@/stores/selectors"
import type { CatalogItem, Category, HistoryEvent } from "@/stores/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 1000 * 60 * 60 * 24

function addEvent(
  itemId: string,
  categoryId: string,
  daysAgo: number,
  now: number
): HistoryEvent {
  return {
    id: crypto.randomUUID(),
    action: "add",
    itemId,
    itemName: "test",
    categoryId,
    categoryName: "",
    timestamp: now - daysAgo * DAY_MS,
  }
}

function removeEvent(
  itemId: string,
  categoryId: string,
  daysAgo: number,
  now: number
): HistoryEvent {
  return {
    id: crypto.randomUUID(),
    action: "remove",
    itemId,
    itemName: "test",
    categoryId,
    categoryName: "",
    timestamp: now - daysAgo * DAY_MS,
  }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000 // fixed reference time

const SEED_CATEGORIES: Category[] = [
  { id: "cat-fridge", name: "Fridge", frequency: "weekly" },
  { id: "cat-pantry", name: "Pantry", frequency: "monthly" },
  { id: "cat-seldom", name: "Rare Stuff", frequency: "seldom" },
]

const SEED_CATALOG: CatalogItem[] = [
  { id: "item-milk", name: "Milk", categoryId: "cat-fridge" },
  { id: "item-eggs", name: "Eggs", categoryId: "cat-fridge" },
  { id: "item-oil", name: "Olive Oil", categoryId: "cat-pantry" },
  { id: "item-rare", name: "Antique Vase", categoryId: "cat-seldom" },
]

// ---------------------------------------------------------------------------
// FREQ_TO_DAYS
// ---------------------------------------------------------------------------

describe("FREQ_TO_DAYS", () => {
  test("maps every CategoryFrequency slug to a positive number", () => {
    const slugs = [
      "daily",
      "every-2-3-days",
      "weekly",
      "every-2-weeks",
      "monthly",
      "every-3-months",
      "seldom",
      "unknown",
    ] as const

    for (const slug of slugs) {
      expect(FREQ_TO_DAYS[slug]).toBeGreaterThan(0)
    }
  })

  test("orders frequencies from shortest to longest interval", () => {
    expect(FREQ_TO_DAYS.daily).toBeLessThan(FREQ_TO_DAYS.weekly)
    expect(FREQ_TO_DAYS.weekly).toBeLessThan(FREQ_TO_DAYS.monthly)
    expect(FREQ_TO_DAYS.monthly).toBeLessThan(FREQ_TO_DAYS["every-3-months"])
  })
})

// ---------------------------------------------------------------------------
// computeItemStats
// ---------------------------------------------------------------------------

describe("computeItemStats", () => {
  test("returns zeroed stats when no history exists for the item", () => {
    const stats = computeItemStats([], "item-milk", NOW)
    expect(stats.purchaseCount).toBe(0)
    expect(stats.daysSinceLastAdded).toBe(0)
    expect(stats.medianInterval).toBeNull()
  })

  test("computes single-purchase stats", () => {
    const history = [addEvent("item-milk", "cat-fridge", 5, NOW)]
    const stats = computeItemStats(history, "item-milk", NOW)

    expect(stats.purchaseCount).toBe(1)
    expect(stats.daysSinceLastAdded).toBeCloseTo(5, 0)
    expect(stats.medianInterval).toBeNull()
  })

  test("computes median interval from multiple purchases", () => {
    // Purchases at days ago: 28, 24, 20, 16, 12 → intervals: 4, 4, 4, 4
    const history = [
      addEvent("item-milk", "cat-fridge", 28, NOW),
      addEvent("item-milk", "cat-fridge", 24, NOW),
      addEvent("item-milk", "cat-fridge", 20, NOW),
      addEvent("item-milk", "cat-fridge", 16, NOW),
      addEvent("item-milk", "cat-fridge", 12, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)

    expect(stats.purchaseCount).toBe(5)
    expect(stats.daysSinceLastAdded).toBeCloseTo(12, 0)
    expect(stats.medianInterval).toBeCloseTo(4, 0)
  })

  test("handles odd number of intervals for median", () => {
    // Purchases at days ago: 30, 25, 20, 15 → intervals: 5, 5, 5
    const history = [
      addEvent("item-milk", "cat-fridge", 30, NOW),
      addEvent("item-milk", "cat-fridge", 25, NOW),
      addEvent("item-milk", "cat-fridge", 20, NOW),
      addEvent("item-milk", "cat-fridge", 15, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)
    expect(stats.medianInterval).toBeCloseTo(5, 0)
  })

  test("handles even number of intervals for median", () => {
    // Purchases at days ago: 20, 15, 10, 5 → intervals: 5, 5, 5
    const history = [
      addEvent("item-milk", "cat-fridge", 20, NOW),
      addEvent("item-milk", "cat-fridge", 15, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 5, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)
    expect(stats.medianInterval).toBeCloseTo(5, 0)
  })

  test("ignores remove events in purchase count", () => {
    const history = [
      addEvent("item-milk", "cat-fridge", 10, NOW),
      removeEvent("item-milk", "cat-fridge", 8, NOW),
      addEvent("item-milk", "cat-fridge", 5, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)

    expect(stats.purchaseCount).toBe(2)
    expect(stats.daysSinceLastAdded).toBeCloseTo(5, 0)
  })

  test("ignores events belonging to other items", () => {
    const history = [
      addEvent("item-eggs", "cat-fridge", 3, NOW),
      addEvent("item-milk", "cat-fridge", 7, NOW),
      addEvent("item-eggs", "cat-fridge", 1, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)

    expect(stats.purchaseCount).toBe(1)
    expect(stats.daysSinceLastAdded).toBeCloseTo(7, 0)
  })

  test("is robust against same-day purchases (zero-length intervals)", () => {
    // Purchases at days ago: 10, 10, 5 → intervals: 0, 5 → median = 2.5
    const history = [
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 5, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)
    expect(stats.purchaseCount).toBe(3)
    expect(stats.medianInterval).toBeCloseTo(2.5, 0)
  })
})

// ---------------------------------------------------------------------------
// getExpectedInterval
// ---------------------------------------------------------------------------

describe("getExpectedInterval", () => {
  test("uses item's median interval when purchase count >= 3", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 5,
      daysSinceLastAdded: 10,
      medianInterval: 4,
    }
    expect(getExpectedInterval(stats, "weekly")).toBe(4)
  })

  test("falls back to category frequency when purchase count < 3", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 2,
      daysSinceLastAdded: 10,
      medianInterval: 3,
    }
    expect(getExpectedInterval(stats, "weekly")).toBe(FREQ_TO_DAYS.weekly)
  })

  test("falls back to category frequency when median is null", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 1,
      daysSinceLastAdded: 10,
      medianInterval: null,
    }
    expect(getExpectedInterval(stats, "monthly")).toBe(FREQ_TO_DAYS.monthly)
  })

  test("falls back to category frequency when median is zero", () => {
    // 3+ adds sharing one timestamp → every interval is 0 → median 0.
    const stats = {
      itemId: "item-milk",
      purchaseCount: 3,
      daysSinceLastAdded: 10,
      medianInterval: 0,
    }
    expect(getExpectedInterval(stats, "weekly")).toBe(FREQ_TO_DAYS.weekly)
  })

  test("falls back to category frequency when median is non-finite", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 3,
      daysSinceLastAdded: 10,
      medianInterval: Number.NaN,
    }
    expect(getExpectedInterval(stats, "weekly")).toBe(FREQ_TO_DAYS.weekly)
  })

  test("uses global default for unknown frequency", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 1,
      daysSinceLastAdded: 10,
      medianInterval: null,
    }
    expect(getExpectedInterval(stats, "unknown")).toBe(14)
  })
})

// ---------------------------------------------------------------------------
// scoreItem
// ---------------------------------------------------------------------------

describe("scoreItem", () => {
  test("returns null for items with zero purchases", () => {
    const stats = {
      itemId: "item-milk",
      purchaseCount: 0,
      daysSinceLastAdded: 0,
      medianInterval: null,
    }
    expect(scoreItem(stats, "weekly")).toBeNull()
  })

  test("scores an overdue item with due_ratio > 1", () => {
    // Bought every 7 days (weekly), last bought 10 days ago → due_ratio = 10/7 ≈ 1.43
    const stats = {
      itemId: "item-milk",
      purchaseCount: 5,
      daysSinceLastAdded: 10,
      medianInterval: 7,
    }
    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    expect(result?.tier).toBe("overdue")
    expect(result?.dueRatio).toBeCloseTo(10 / 7, 2)
  })

  test("scores a 'soon' item with due_ratio between 0.7 and 1.0", () => {
    // Bought every 7 days, last bought 6 days ago → due_ratio = 6/7 ≈ 0.86
    const stats = {
      itemId: "item-milk",
      purchaseCount: 5,
      daysSinceLastAdded: 6,
      medianInterval: 7,
    }
    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    expect(result?.tier).toBe("soon")
  })

  test("scores a 'frequent' item with due_ratio <= 0.7", () => {
    // Bought every 7 days, last bought 3 days ago → due_ratio = 3/7 ≈ 0.43
    const stats = {
      itemId: "item-milk",
      purchaseCount: 5,
      daysSinceLastAdded: 3,
      medianInterval: 7,
    }
    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    expect(result?.tier).toBe("frequent")
  })

  test("applies confidence penalty for low purchase counts", () => {
    // 1 purchase → confidence = 0.2, due_ratio = 10/7 ≈ 1.43
    const stats = {
      itemId: "item-milk",
      purchaseCount: 1,
      daysSinceLastAdded: 10,
      medianInterval: null,
    }
    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    // score = 1.43 * 0.2 = 0.286
    expect(result?.score).toBeCloseTo((10 / 7) * 0.2, 2)
  })

  test("reaches full confidence at 5+ purchases", () => {
    const statsA = {
      itemId: "item-milk",
      purchaseCount: 5,
      daysSinceLastAdded: 10,
      medianInterval: 7,
    }
    const statsB = {
      itemId: "item-milk",
      purchaseCount: 10,
      daysSinceLastAdded: 10,
      medianInterval: 7,
    }
    const resultA = scoreItem(statsA, "weekly")
    const resultB = scoreItem(statsB, "weekly")
    // Both have confidence = 1.0, so scores are identical.
    expect(resultA?.score).toBeCloseTo(resultB?.score, 4)
  })

  test("produces a finite score when all purchases share one timestamp", () => {
    // Identical timestamps → zero-length intervals → median 0; the item must
    // fall back to the category default instead of dividing by zero.
    const history = [
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
    ]
    const stats = computeItemStats(history, "item-milk", NOW)
    expect(stats.medianInterval).toBe(0)

    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    // 10 days / weekly default (7) → overdue, not NaN/Infinity.
    expect(Number.isFinite(result?.score)).toBe(true)
    expect(Number.isFinite(result?.dueRatio)).toBe(true)
    expect(result?.tier).toBe("overdue")
    expect(result?.dueRatio).toBeCloseTo(10 / 7, 2)
  })

  test("scores sanely when re-added immediately with a degenerate interval", () => {
    // daysSinceLastAdded = 0 with a zero median → previously 0/0 = NaN.
    const stats = {
      itemId: "item-milk",
      purchaseCount: 3,
      daysSinceLastAdded: 0,
      medianInterval: 0,
    }
    const result = scoreItem(stats, "weekly")
    expect(result).not.toBeNull()
    expect(Number.isFinite(result?.score)).toBe(true)
    expect(result?.tier).toBe("frequent")
  })
})

// ---------------------------------------------------------------------------
// computeRecommendations
// ---------------------------------------------------------------------------

describe("computeRecommendations", () => {
  const categories = SEED_CATEGORIES
  const catalog = SEED_CATALOG

  test("returns empty array when history is empty", () => {
    const recs = computeRecommendations([], catalog, categories, [], NOW)
    expect(recs).toEqual([])
  })

  test("excludes items with 'seldom' frequency", () => {
    const history = [addEvent("item-rare", "cat-seldom", 5, NOW)]
    const recs = computeRecommendations(history, catalog, categories, [], NOW)
    expect(recs.find((r) => r.item.id === "item-rare")).toBeUndefined()
  })

  test("excludes items currently on the active list", () => {
    const history = [addEvent("item-milk", "cat-fridge", 10, NOW)]
    const list = [{ itemId: "item-milk", id: "e1", checked: false, addedAt: 0 }]
    const recs = computeRecommendations(history, catalog, categories, list, NOW)
    expect(recs.find((r) => r.item.id === "item-milk")).toBeUndefined()
  })

  test("sorts results by score descending", () => {
    const history = [
      // Milk: overdue (14 days since last, weekly interval)
      addEvent("item-milk", "cat-fridge", 14, NOW),
      addEvent("item-milk", "cat-fridge", 7, NOW),
      addEvent("item-milk", "cat-fridge", 0, NOW),
      // Eggs: also overdue but less so
      addEvent("item-eggs", "cat-fridge", 10, NOW),
      addEvent("item-eggs", "cat-fridge", 5, NOW),
      addEvent("item-eggs", "cat-fridge", 0, NOW),
    ]
    const recs = computeRecommendations(history, catalog, categories, [], NOW)
    expect(recs.length).toBeGreaterThanOrEqual(2)
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score)
  })

  test("keeps ordering defined when all adds share one timestamp", () => {
    // Milk's zero median must fall back to the weekly default, keeping every
    // score finite and the descending sort deterministic (no NaN comparator).
    const history = [
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 10, NOW),
      // Eggs has a real 7-day cadence and is less overdue.
      addEvent("item-eggs", "cat-fridge", 20, NOW),
      addEvent("item-eggs", "cat-fridge", 13, NOW),
      addEvent("item-eggs", "cat-fridge", 6, NOW),
    ]
    const recs = computeRecommendations(history, catalog, categories, [], NOW)
    expect(recs).toHaveLength(2)
    for (const rec of recs) {
      expect(Number.isFinite(rec.score)).toBe(true)
      expect(Number.isFinite(rec.dueRatio)).toBe(true)
    }
    expect(recs[0].item.id).toBe("item-milk")
    expect(recs[1].item.id).toBe("item-eggs")
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score)
  })

  test("includes categoryName from the matching category", () => {
    const history = [
      addEvent("item-milk", "cat-fridge", 10, NOW),
      addEvent("item-milk", "cat-fridge", 5, NOW),
    ]
    const recs = computeRecommendations(history, catalog, categories, [], NOW)
    const milk = recs.find((r) => r.item.id === "item-milk")
    expect(milk).toBeDefined()
    expect(milk?.categoryName).toBe("Fridge")
  })

  test("falls back to 'Uncategorized' for missing category", () => {
    const orphanItem: CatalogItem = {
      id: "item-orphan",
      name: "Orphan",
      categoryId: "missing-cat",
    }
    const history = [addEvent("item-orphan", "missing-cat", 10, NOW)]
    const recs = computeRecommendations(
      history,
      [...catalog, orphanItem],
      categories,
      [],
      NOW
    )
    const orphan = recs.find((r) => r.item.id === "item-orphan")
    expect(orphan).toBeDefined()
    expect(orphan?.categoryName).toBe("Uncategorized")
  })
})

// ---------------------------------------------------------------------------
// $recommendations computed store
// ---------------------------------------------------------------------------

describe("$recommendations", () => {
  beforeEach(() => {
    $categories.set(SEED_CATEGORIES)
    $catalog.set(SEED_CATALOG)
    $history.set([])
    $list.set([])
  })

  test("starts empty with no history", () => {
    expect($recommendations.get()).toEqual([])
  })

  test("returns recommendations when history exists", () => {
    const history = [
      addEvent("item-milk", "cat-fridge", 10, Date.now()),
      addEvent("item-milk", "cat-fridge", 5, Date.now()),
    ]
    $history.set(history)

    const recs = $recommendations.get()
    expect(recs.length).toBeGreaterThanOrEqual(1)
    expect(recs[0].item.id).toBe("item-milk")
  })

  test("excludes items on the list", () => {
    $history.set([
      addEvent("item-milk", "cat-fridge", 10, Date.now()),
      addEvent("item-milk", "cat-fridge", 5, Date.now()),
    ])
    $list.set([
      { id: "e1", itemId: "item-milk", checked: false, addedAt: Date.now() },
    ])

    const recs = $recommendations.get()
    expect(recs.find((r) => r.item.id === "item-milk")).toBeUndefined()
  })
})
