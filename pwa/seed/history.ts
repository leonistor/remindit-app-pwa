// Frequency-aware shopping history for first-run seeding.
//
// Thin adaptor over the shared simulator in `@remindit/common/seeds`
// (`generateTeamHistory`). The pwa-facing API (defaults, option shape, return
// type) is preserved exactly; the algorithm, PRNG, and event-id scheme now live
// in one place in `common` so the pwa and platform seed paths can never drift.
//
// NOTE: the pwa's default seed stays 42 (common's default is 1). Keep the two
// in sync so callers omitting `seed` get the same output as before this refactor.

import { generateTeamHistory } from "@remindit/common/seeds"
import type { CatalogItem, Category, HistoryEvent } from "@/stores/types"

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

export function generateShoppingHistory(opts: GenerateHistoryOptions): HistoryEvent[] {
  const {
    catalog,
    categories,
    days = DEFAULT_HISTORY_DAYS,
    seed = DEFAULT_HISTORY_SEED,
    now,
  } = opts
  return generateTeamHistory(catalog, categories, { days, seed, now })
}
