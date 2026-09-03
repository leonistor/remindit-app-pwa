// Store entry-point: wires the modules together and exposes the public API.
//
// IMPORTANT: this barrel has NO side effects. Seeding (`initStores`) and the
// dev logger (`setupDevLogging`) are explicit bootstrap calls the app entry
// point invokes once — so importing a store (e.g. from a test or a component)
// never triggers persistence writes or logging on its own.

import { logger } from "@nanostores/logger"
import { generateShoppingHistory, getDataset, resolveDatasetId } from "seed"
import { $catalog } from "./catalog"
import {
  $categories,
  assignCategoryColors,
  ensureUncategorizedExists,
  normalizeCategoryColors,
  normalizeCategoryFrequencies,
} from "./categories"
import { $history } from "./history"
import { $list } from "./list"
import {
  isOnboarded,
  resolveSelectedDataset,
  setOnboarded,
  setSelectedDataset,
} from "./onboarding"
import { initActivePalette } from "./palette"
import { STORAGE_KEYS } from "./persistence"
import { initTheme } from "./theme"
import type { Category, UserProfile } from "./types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "./types"
import { $user, randomUser, updateUser } from "./user"

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
      // BFF origin — sync RPC + the /pb/* data-plane forwarder (phase 5).
      PUBLIC_BFF_URL?: string
      // Feedback (Apache Answer) origin — footer link (env-driven, D9).
      PUBLIC_FEEDBACK_URL?: string
      [key: string]: unknown
    }
  }
}

// Prepends the "uncategorized" sentinel and assigns sequential palette color
// slots so the dataset categories are display-ready. Shared by `initStores`
// (first run) and `seedFromDataset` (onboarding / reset) so the two seeding
// paths can't diverge in how the sentinel + colors are built.
function seedCategories(categories: Category[]): Category[] {
  return assignCategoryColors([
    { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, frequency: "unknown" },
    ...categories,
  ])
}

// Seed the catalog + categories on first run from the dataset selected by the
// user during onboarding (persisted as `selectedDataset`, falling back to the
// build-time PUBLIC_DATASET, then the default dataset id). Safe to call
// multiple times; only never-seeded storage gets the seed (see below).
//
// When the user is NOT yet onboarded we intentionally do nothing here: the
// catalog/history/profile are seeded later by `completeOnboarding` once the
// onboarding flow has picked a dataset and built a profile. This keeps the
// first-run app lightweight (no catalog) and defers the choice to the user.
export function initStores(): void {
  // Apply the persisted theme as early as the store layer loads.
  initTheme()
  // Reset a stale, invalid persisted palette id once at startup (no-op otherwise).
  initActivePalette()

  if (!isOnboarded()) return

  // Emptiness is no longer the first-run marker: a user who deletes every
  // catalog item persists an explicitly empty catalog, so re-seeding on
  // emptiness would resurrect the dataset on every reload. Only storage with
  // no catalog record at all is first-run storage.
  if (
    $catalog.get().length === 0 &&
    localStorage.getItem(STORAGE_KEYS.catalog) === null
  ) {
    const datasetId = resolveSelectedDataset()
    const { categories, catalog } = getDataset(datasetId)
    // Categories always ship with the catalog so seeded items can never end up
    // with dangling categoryIds against the user's remaining categories.
    $categories.set(seedCategories(categories))
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
  // Backfill `color` slots so categories stay distinct in the categorical palette.
  normalizeCategoryColors()
}

// Finalizes onboarding: persists the chosen profile + dataset, seeds the catalog
// from the chosen dataset (with a fresh first-run history), and flips the
// onboarded flag so the app leaves the onboarding gate. Called from the
// Onboarding view after the user accepts their profile and dataset.
export function completeOnboarding(
  profile: UserProfile,
  datasetId: string
): void {
  updateUser(profile)
  setSelectedDataset(datasetId)
  seedFromDataset(datasetId, profile)
  setOnboarded(true)
}

// Runtime reset + reseed: wipes all user data (list, history, catalog,
// categories, profile) and repopulates the catalog/categories from the chosen
// dataset, regenerating a fresh random user and first-run history. The theme
// preference (remindit:theme) is intentionally left untouched. Unlike
// initStores, this always overwrites — it is the user-initiated "reset app"
// path exposed from Profile, so it does not guard on store emptiness and takes
// the dataset id explicitly rather than reading the build-time PUBLIC_DATASET.
//
// When `profile` is supplied (onboarding or a reset that regenerates the
// profile via the DiceBear generator), it becomes the new user profile;
// otherwise a synchronous offline fallback profile is used.
export function seedFromDataset(
  datasetId: string,
  profile?: UserProfile
): void {
  const resolved = resolveDatasetId(datasetId)
  const { categories, catalog } = getDataset(resolved)

  // Wipe user-generated state first so the reseed starts from a clean slate.
  $list.set([])
  $history.set([])
  $user.set(profile ?? randomUser())

  $categories.set(seedCategories(categories))
  $catalog.set(catalog)

  if (import.meta.env?.PUBLIC_SEED_HISTORY !== "0") {
    $history.set(
      generateShoppingHistory({ catalog, categories, days: 180, seed: 42 })
    )
  }

  ensureUncategorizedExists()
  normalizeCategoryFrequencies()
}

// Dev-only store logging. Call this once from the app entry point; it is a
// no-op outside development builds. Kept out of `initStores` so the logger is
// never wired just by importing a store.
export function setupDevLogging(): void {
  if (!import.meta.env?.DEV) return
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
export * from "./commands"
export * from "./history"
export * from "./list"
export * from "./onboarding"
export * from "./palette"
export * from "./pwa-install"
export * from "./recommender"
export * from "./selectors"
export * from "./theme"
// Public API surface — import everything from '@/stores'.
export * from "./types"
export * from "./ui"
export * from "./user"
