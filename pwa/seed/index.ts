// Typed loader for the grocery seed datasets.
//
// Normalizes raw sample rows into store-shaped `Category` / `CatalogItem`
// collections using DETERMINISTIC ids. The id scheme is copied byte-for-byte
// from `tests/fixtures/history.ts` (FNV-1a) so test fixtures and the app share
// stable, reproducible identifiers — existing tests keep producing the same
// category/item ids.

import type { CatalogItem, Category, CategoryFrequency } from "@/stores/types"
import { UNCATEGORIZED_ID } from "@/stores/types"
import { hashId } from "@remindit/common/seeds"
import rawItemsCategories from "./items_categories.json"
import rawLeoRomanian from "./leo_romanian.json"
import rawMinimal from "./minimal.json"
import rawRickMorty from "./rick_morty.json"

export interface RawSeedItem {
  category_name: string
  name: string
}

// A tracked seed dataset. Add a new dataset by dropping its JSON into `seed/`
// and appending a `DatasetMeta` entry here — the loader picks it up automatically.
export interface DatasetMeta {
  /** Stable key, used as a lookup id and for deterministic seeding. */
  id: string
  /** Human-readable label (UI, logs). */
  name: string
  /** Seed-relative filename of the source JSON. */
  file: string
}

export const DATASETS: DatasetMeta[] = [
  {
    id: "minimal",
    name: "Minimal (starter)",
    file: "minimal.json",
  },
  {
    id: "items_categories",
    name: "English groceries",
    file: "items_categories.json",
  },
  { id: "leo_romanian", name: "Leo's Romanian", file: "leo_romanian.json" },
  { id: "rick_morty", name: "Rick & Morty", file: "rick_morty.json" },
]

// The starter dataset onboarding selects by default — a small, curated subset of
// the full English groceries catalog so first-time users aren't overwhelmed.
export const DEFAULT_DATASET_ID = "minimal"

// Per-category purchase frequency for the sample catalog. Single source of truth
// shared with the app seeder (`src/stores/index.ts`). Only the English set has
// curated frequencies; other datasets fall back to "unknown".
export const FREQUENCY_BY_CATEGORY: Record<string, CategoryFrequency> = {
  household: "monthly",
  snacks: "every-2-weeks",
  cooking: "weekly",
  pantry: "monthly",
  fridge: "weekly",
  cleaning: "every-3-months",
}

// FNV-1a 32-bit hash → zero-padded 8-char hex string. Shared so the loader and
// the history generator produce stable, reproducible ids. Defined in `./hash`.
export { hashId }

// Normalizes raw rows into store-shaped categories + catalog. Rows with an empty
// `category_name` are assigned to `UNCATEGORIZED_ID` and never produce a
// (broken) empty-named category.
export function buildCategoriesAndCatalog(rows: RawSeedItem[]): {
  categories: Category[]
  catalog: CatalogItem[]
} {
  const categoryNames = [
    ...new Set(
      rows
        .map((row) => row.category_name.trim())
        .filter((name) => name.length > 0)
    ),
  ]

  const categoryIdByName: Record<string, string> = {}
  const categories: Category[] = categoryNames.map((name) => {
    const id = hashId(`cat::${name}`)
    categoryIdByName[name] = id
    return { id, name, frequency: FREQUENCY_BY_CATEGORY[name] ?? "unknown" }
  })

  const catalog: CatalogItem[] = rows.map((row) => {
    const categoryName = row.category_name.trim()
    return {
      id: hashId(`item::${categoryName}::${row.name}`),
      name: row.name,
      categoryId: categoryName
        ? categoryIdByName[categoryName]
        : UNCATEGORIZED_ID,
    }
  })

  return { categories, catalog }
}

const DATASET_ROWS: Record<string, RawSeedItem[]> = {
  minimal: rawMinimal as RawSeedItem[],
  items_categories: rawItemsCategories as RawSeedItem[],
  leo_romanian: rawLeoRomanian as RawSeedItem[],
  rick_morty: rawRickMorty as RawSeedItem[],
}

// Resolve any registered dataset into its raw rows + normalized collections.
export function getDataset(id: string): {
  rawItems: RawSeedItem[]
  categories: Category[]
  catalog: CatalogItem[]
} {
  const rawItems = DATASET_ROWS[id] ?? []
  const { categories, catalog } = buildCategoriesAndCatalog(rawItems)
  return { rawItems, categories, catalog }
}

/**
 * Resolves which registered dataset to seed from, given a raw candidate id
 * (typically read from the `PUBLIC_DATASET` env var by `initStores()`).
 *
 * Validates `raw` against `DATASETS` and falls back to `DEFAULT_DATASET_ID` for
 * empty/undefined/unknown values, warning loudly so a typo doesn't silently
 * seed the wrong catalog.
 *
 * Pure (no env access) so callers own the env read and it is trivially
 * unit-testable — pass any string to validate it without touching `import.meta`.
 */
export function resolveDatasetId(raw: string | undefined): string {
  if (raw && DATASETS.some((d) => d.id === raw)) return raw
  if (raw) {
    console.warn(
      `[seed] PUBLIC_DATASET="${raw}" is not a registered dataset id; ` +
        `falling back to "${DEFAULT_DATASET_ID}". ` +
        `Valid ids: ${DATASETS.map((d) => d.id).join(", ")}.`
    )
  }
  return DEFAULT_DATASET_ID
}

// Backwards-compatible exports for the default dataset (used by the history
// fixture and existing tests). New code should prefer `getDataset(id)`.
export const rawItems: RawSeedItem[] = DATASET_ROWS[DEFAULT_DATASET_ID]
export const { categories, catalog } = buildCategoriesAndCatalog(rawItems)

// Frequency-aware, reproducible history generator used by the first-run seeder
// (`src/stores/index.ts`). Kept in its own module so the loader stays focused.
export { generateShoppingHistory } from "./history"
