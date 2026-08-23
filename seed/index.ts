// Typed loader for the grocery seed catalog.
//
// Normalizes the raw sample rows (`items_categories.json`) into store-shaped
// `Category` / `CatalogItem` collections using DETERMINISTIC ids. The id scheme
// is copied byte-for-byte from `tests/fixtures/history.ts` (FNV-1a) so that test
// fixtures and the app share stable, reproducible identifiers — existing tests
// keep producing the same category/item ids.

import type { CatalogItem, Category } from "@/stores/types"
import rawSample from "./items_categories.json"

export interface RawSeedItem {
  category_name: string
  name: string
}

export const rawItems: RawSeedItem[] = rawSample as RawSeedItem[]

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

// `Set` preserves first-appearance order, which is deterministic and matches the
// ordering `tests/fixtures/history.ts` derives, so both sources agree.
const categoryNames = [...new Set(rawItems.map((row) => row.category_name))]

export const categories: Category[] = categoryNames.map((name) => ({
  id: hashId(`cat::${name}`),
  name,
}))

// Precomputed map so every catalog row resolves its category id cheaply and to
// the exact same value as `categories` above.
const categoryIdByName: Record<string, string> = {}
for (const name of categoryNames) {
  categoryIdByName[name] = hashId(`cat::${name}`)
}

export const catalog: CatalogItem[] = rawItems.map((row) => ({
  id: hashId(`item::${row.category_name}::${row.name}`),
  name: row.name,
  categoryId: categoryIdByName[row.category_name],
}))
