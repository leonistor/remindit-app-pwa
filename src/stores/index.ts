// Store entry-point: wires the modules together, seeds sample data on first
// run, assigns random user defaults, and (dev-only) attaches the logger.

import { logger } from "@nanostores/logger"
import seedRows from "../../seed/items_categories.json"
import { $catalog } from "./catalog"
import {
  $categories,
  ensureUncategorizedExists,
  normalizeCategoryFrequencies,
} from "./categories"
import { $history } from "./history"
import { $list } from "./list"
import type { CatalogItem, Category } from "./types"
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
      [key: string]: unknown
    }
  }
}

interface SeedRow {
  category_name: string
  name: string
}

function buildSeed(): { categories: Category[]; items: CatalogItem[] } {
  const rows = seedRows as SeedRow[]
  const categoryIdByName = new Map<string, string>()
  const categories: Category[] = []
  const items: CatalogItem[] = []

  for (const row of rows) {
    const categoryName = row.category_name.trim()
    let categoryId = categoryIdByName.get(categoryName)
    if (!categoryId) {
      categoryId = crypto.randomUUID()
      categoryIdByName.set(categoryName, categoryId)
      categories.push({
        id: categoryId,
        name: categoryName,
        frequency: "unknown",
      })
    }
    items.push({
      id: crypto.randomUUID(),
      name: row.name.trim(),
      categoryId,
    })
  }
  return { categories, items }
}

// Seed the catalog + categories from the sample JSON on first run (empty
// persistent stores). Assigns random user defaults when none exist. Safe to
// call multiple times; it only acts when stores are empty.
export function initStores(): void {
  if ($catalog.get().length === 0) {
    const { categories, items } = buildSeed()
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
    $catalog.set(items)
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
export * from "./selectors"
// Public API surface — import everything from '@/stores'.
export * from "./types"
export * from "./user"
