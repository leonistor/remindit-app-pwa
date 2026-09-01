// Recommendation engine: pure-function scoring that derives item recommendations
// from shopping history, category frequency defaults, and catalog data.
//
// The only entry point that touches stores is $recommendations (in selectors.ts);
// every function here is a pure computation over plain data.

import type {
  CatalogItem,
  Category,
  CategoryFrequency,
  HistoryEvent,
  Recommendation,
  RecommendationTier,
} from "./types"
import { UNCATEGORIZED_NAME } from "./types"

// CategoryFrequency → expected days between purchases. Used as fallback when an
// item has too few purchases to estimate its own interval.
export const FREQ_TO_DAYS: Record<CategoryFrequency, number> = {
  daily: 1,
  "every-2-3-days": 2.5,
  weekly: 7,
  "every-2-weeks": 14,
  monthly: 30,
  "every-3-months": 90,
  seldom: 180,
  unknown: 14,
}

const GLOBAL_DEFAULT_INTERVAL = 14

// Minimum purchase count before we start trusting the item's own interval
// (below this we blend toward the category default via confidence_factor).
const CONFIDENCE_THRESHOLD = 5

export interface ItemStats {
  itemId: string
  purchaseCount: number
  daysSinceLastAdded: number
  medianInterval: number | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Sort ascending and return the middle value (or average of two middles). */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

/**
 * Derive per-item statistics from the full history log.
 *
 * @param history  The complete history event array.
 * @param itemId   Item to compute stats for.
 * @param now      Reference timestamp (ms). Defaults to Date.now().
 */
export function computeItemStats(
  history: HistoryEvent[],
  itemId: string,
  now: number = Date.now()
): ItemStats {
  // Only "add" events define the purchase cadence.
  const adds = history
    .filter((e) => e.itemId === itemId && e.action === "add")
    .sort((a, b) => a.timestamp - b.timestamp)

  const purchaseCount = adds.length
  if (purchaseCount === 0) {
    return {
      itemId,
      purchaseCount: 0,
      daysSinceLastAdded: 0,
      medianInterval: null,
    }
  }

  const lastAddedAt = adds[adds.length - 1].timestamp
  const daysSinceLastAdded = (now - lastAddedAt) / (1000 * 60 * 60 * 24)

  // Compute intervals between consecutive adds.
  const intervals: number[] = []
  for (let i = 1; i < adds.length; i++) {
    const diffMs = adds[i].timestamp - adds[i - 1].timestamp
    intervals.push(diffMs / (1000 * 60 * 60 * 24))
  }

  return {
    itemId,
    purchaseCount,
    daysSinceLastAdded,
    medianInterval: median(intervals),
  }
}

/**
 * Determine the expected reorder interval for an item.
 *
 * Hierarchy:
 *   item's median interval (if ≥3 purchases, and positive/finite)
 *   → category's frequency default
 *   → global default (14 days)
 */
export function getExpectedInterval(
  stats: ItemStats,
  categoryFrequency: CategoryFrequency
): number {
  // A zero or non-finite median (e.g. 3+ adds sharing one timestamp) carries no
  // cycle information → fall through to the next precedence level.
  if (
    stats.purchaseCount >= 3 &&
    stats.medianInterval !== null &&
    Number.isFinite(stats.medianInterval) &&
    stats.medianInterval > 0
  ) {
    return stats.medianInterval
  }
  return FREQ_TO_DAYS[categoryFrequency] ?? GLOBAL_DEFAULT_INTERVAL
}

export interface ScoredItem {
  score: number
  dueRatio: number
  tier: RecommendationTier
}

/**
 * Score a single item based on its stats and category frequency.
 *
 *   score = due_ratio × confidence_factor
 *
 * - due_ratio > 1.0 means the item is overdue relative to its normal cycle.
 * - confidence_factor penalizes items with sparse purchase history.
 */
export function scoreItem(
  stats: ItemStats,
  categoryFrequency: CategoryFrequency
): ScoredItem | null {
  // No history → nothing to recommend.
  if (stats.purchaseCount === 0) return null

  const expectedInterval = getExpectedInterval(stats, categoryFrequency)
  const dueRatio = stats.daysSinceLastAdded / expectedInterval

  // Defense-in-depth: a non-finite ratio (degenerate interval or elapsed time)
  // can't be ranked fairly and would pin the item as top "overdue" forever.
  // Skipping (like the no-history case) is safer than clamping, since e.g.
  // daysSinceLastAdded = 0 would also poison a clamped ratio.
  if (!Number.isFinite(dueRatio)) return null

  // confidence_factor ramps from 0.2 (1 purchase) to 1.0 (5+ purchases).
  const confidenceFactor = Math.min(
    stats.purchaseCount / CONFIDENCE_THRESHOLD,
    1
  )
  const score = dueRatio * confidenceFactor

  let tier: RecommendationTier
  if (dueRatio > 1.0) {
    tier = "overdue"
  } else if (dueRatio > 0.7) {
    tier = "soon"
  } else {
    tier = "frequent"
  }

  return { score, dueRatio, tier }
}

/**
 * Score all catalog items and return recommendations sorted by score descending.
 *
 * Exclusions:
 * - Items belonging to a category with frequency "seldom".
 * - Items currently on the active list.
 * - Items with zero purchase history.
 */
export function computeRecommendations(
  history: HistoryEvent[],
  catalog: CatalogItem[],
  categories: Category[],
  list: { itemId: string }[],
  now: number = Date.now()
): Recommendation[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const onList = new Set(list.map((e) => e.itemId))

  const results: Recommendation[] = []

  for (const item of catalog) {
    // Skip items on the active list.
    if (onList.has(item.id)) continue

    const category = categoryById.get(item.categoryId)
    const freq = category?.frequency ?? "unknown"

    // Always exclude "seldom" items.
    if (freq === "seldom") continue

    const stats = computeItemStats(history, item.id, now)
    const scored = scoreItem(stats, freq)
    if (!scored) continue

    results.push({
      item,
      categoryName: category?.name ?? UNCATEGORIZED_NAME,
      score: scored.score,
      dueRatio: scored.dueRatio,
      tier: scored.tier,
    })
  }

  // Highest score first.
  results.sort((a, b) => b.score - a.score)
  return results
}
