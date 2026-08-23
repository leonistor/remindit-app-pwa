// Typed loader for the grocery seed datasets.
//
// Normalizes raw sample rows into store-shaped `Category` / `CatalogItem`
// collections using DETERMINISTIC ids. The id scheme is copied byte-for-byte
// from `tests/fixtures/history.ts` (FNV-1a) so test fixtures and the app share
// stable, reproducible identifiers — existing tests keep producing the same
// category/item ids.

import type { CatalogItem, Category, CategoryFrequency } from "@/stores/types"
import { UNCATEGORIZED_ID } from "@/stores/types"
import rawItemsCategories from "./items_categories.json"
import rawLeoRomanian from "./leo_romanian.json"
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
    id: "items_categories",
    name: "English groceries",
    file: "items_categories.json",
  },
  { id: "leo_romanian", name: "Leo's Romanian", file: "leo_romanian.json" },
  { id: "rick_morty", name: "Rick & Morty", file: "rick_morty.json" },
]

export const DEFAULT_DATASET_ID = "items_categories"

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

// FNV-1a 32-bit hash → zero-padded 8-char hex string. Copied verbatim from
// `tests/fixtures/history.ts` so existing test ids stay reproducible.
export function hashId(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

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

// Backwards-compatible exports for the default dataset (used by the history
// fixture and existing tests). New code should prefer `getDataset(id)`.
export const rawItems: RawSeedItem[] = DATASET_ROWS[DEFAULT_DATASET_ID]
export const { categories, catalog } = buildCategoriesAndCatalog(rawItems)
