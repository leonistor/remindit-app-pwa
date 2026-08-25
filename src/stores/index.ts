// Store entry-point: wires the modules together, seeds sample data on first
// run, assigns random user defaults, and (dev-only) attaches the logger.

import { logger } from "@nanostores/logger"
import { getDataset, resolveDatasetId } from "../../seed"
import { $catalog } from "./catalog"
import {
  $categories,
  ensureUncategorizedExists,
  normalizeCategoryFrequencies,
} from "./categories"
import { $history } from "./history"
import { $list } from "./list"
import { initTheme } from "./theme"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "./types"
import { $user, randomUser } from "./user"

// Rsbuild exposes import.meta.env.DEV at build time. Declared here so the
// project's tsconfig (which does not ship Rsbuild client types) type-checks.
declare global {
  interface ImportMeta {
    env?: {
      DEV?: boolean
      PROD?: boolean
      MODE?: string
      // Public (client-exposed via Rsbuild's `PUBLIC_` convention). Selects the
      // seed dataset on first run — see .env / .env.example.
      PUBLIC_DATASET?: string
      [key: string]: unknown
    }
  }
}

// Seed the catalog + categories on first run (empty persistent stores) from the
// dataset selected via PUBLIC_DATASET (.env / .env.example); unknown/empty
// values fall back to DEFAULT_DATASET_ID with a warning. Also assigns random
// user defaults when none exists. Safe to call multiple times; acts only when
// stores are empty.
export function initStores(): void {
  // Apply the persisted theme as early as the store layer loads.
  initTheme()

  if ($catalog.get().length === 0) {
    const datasetId = resolveDatasetId(import.meta.env?.PUBLIC_DATASET)
    const { categories, catalog } = getDataset(datasetId)
    if ($categories.get().length === 0) {
      $categories.set([
        {
          id: UNCATEGORIZED_ID,
          name: UNCATEGORIZED_NAME,
          frequency: "unknown",
        },
        ...categories,
      ])
    }
    $catalog.set(catalog)
  }
  ensureUncategorizedExists()
  // Backfill `frequency` onto any category persisted before this field existed.
  normalizeCategoryFrequencies()

  const user = $user.get()
  if (!user.name) $user.set(randomUser())
}

// Run seeding as soon as this module is loaded in the browser.
initStores()

// Dev-only store logging. Guarded so it never runs in production builds.
if (import.meta.env?.DEV) {
  logger({
    catalog: $catalog,
    list: $list,
    categories: $categories,
    history: $history,
    user: $user,
  })
}

export * from "./catalog"
export * from "./categories"
export * from "./history"
export * from "./list"
export * from "./recommender"
export * from "./selectors"
export * from "./theme"
// Public API surface — import everything from '@/stores'.
export * from "./types"
export * from "./user"
