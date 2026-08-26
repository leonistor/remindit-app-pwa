// Store entry-point: wires the modules together, seeds sample data on first
// run, assigns random user defaults, and (dev-only) attaches the logger.

import { logger } from "@nanostores/logger"
import {
  generateShoppingHistory,
  getDataset,
  resolveDatasetId,
} from "../../seed"
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

    // First-run history seed: a realistic 6-month shopping history so the
    // recommender has data to surface on a fresh install. Always on; set
    // PUBLIC_SEED_HISTORY=0 in .env to skip. Only runs when history is empty,
    // so it is a no-op once a user has any history of their own.
    if (
      import.meta.env?.PUBLIC_SEED_HISTORY !== "0" &&
      $history.get().length === 0
    ) {
      $history.set(
        generateShoppingHistory({ catalog, categories, days: 180, seed: 42 })
      )
    }
  }
  ensureUncategorizedExists()
  // Backfill `frequency` onto any category persisted before this field existed.
  normalizeCategoryFrequencies()

  const user = $user.get()
  if (!user.name) $user.set(randomUser())
}

// Runtime reset + reseed: wipes all user data (list, history, catalog,
// categories, profile) and repopulates the catalog/categories from the chosen
// dataset, regenerating a fresh random user and first-run history. The theme
// preference (remindit:theme) is intentionally left untouched. Unlike
// initStores, this always overwrites — it is the user-initiated "reset app"
// path exposed from Settings, so it does not guard on store emptiness and takes
// the dataset id explicitly rather than reading the build-time PUBLIC_DATASET.
export function seedFromDataset(datasetId: string): void {
  const resolved = resolveDatasetId(datasetId)
  const { categories, catalog } = getDataset(resolved)

  // Wipe user-generated state first so the reseed starts from a clean slate.
  $list.set([])
  $history.set([])
  $user.set(randomUser())

  $categories.set([
    {
      id: UNCATEGORIZED_ID,
      name: UNCATEGORIZED_NAME,
      frequency: "unknown",
    },
    ...categories,
  ])
  $catalog.set(catalog)

  if (import.meta.env?.PUBLIC_SEED_HISTORY !== "0") {
    $history.set(
      generateShoppingHistory({ catalog, categories, days: 180, seed: 42 })
    )
  }

  ensureUncategorizedExists()
  normalizeCategoryFrequencies()
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
export * from "./ui"
export * from "./user"
