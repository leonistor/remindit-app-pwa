// Derived / computed views used by the main screen. Components stay dumb and
// read these instead of recomputing grouping logic themselves.

import { computed } from "nanostores"
import { $catalog } from "./catalog"
import { $categories } from "./categories"
import { $list } from "./list"
import type { CatalogItem, Category, ListEntry } from "./types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "./types"

export interface GroupedItem {
  entry: ListEntry
  item: CatalogItem
}

export interface CategoryGroup {
  category: Category
  items: GroupedItem[]
}

// Active list entries grouped under their category, preserving the order of
// $categories so the UI layout stays stable. Only categories that currently
// have at least one entry are returned.
export const $itemsByCategory = computed(
  [$list, $catalog, $categories],
  (list, catalog, categories) => {
    const itemById = new Map(catalog.map((item) => [item.id, item]))
    const itemsByCategory = new Map<string, GroupedItem[]>()

    for (const entry of list) {
      const item = itemById.get(entry.itemId)
      if (!item) continue
      let group = itemsByCategory.get(item.categoryId)
      if (!group) {
        group = []
        itemsByCategory.set(item.categoryId, group)
      }
      group.push({ entry, item })
    }

    const result: CategoryGroup[] = []
    for (const category of categories) {
      const items = itemsByCategory.get(category.id)
      if (items && items.length > 0) {
        result.push({ category, items })
      }
    }
    return result
  }
)

// Ids of categories that currently have at least one active list entry.
export const $activeCategoryIds = computed($itemsByCategory, (groups) =>
  groups.map((group) => group.category.id)
)

export const $listCount = computed($list, (list) => list.length)

export const $checkedCount = computed(
  $list,
  (list) => list.filter((entry) => entry.checked).length
)

// Catalog items enriched with their category's display name. Backs the catalog
// panel's rows so components don't re-derive the lookup. Falls back to
// "Uncategorized" for items whose category is missing or has been deleted.
export interface CatalogViewItem {
  id: string
  name: string
  categoryId: string
  categoryName: string
}

export const $catalogView = computed(
  [$catalog, $categories],
  (catalog, categories) => {
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
    return catalog.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: categoryNameById.get(item.categoryId) ?? UNCATEGORIZED_NAME,
    }))
  }
)

// Active list entries joined to their catalog item (for name + category) and to
// the category (for categoryName). Mirrors the shape the list panel renders, so
// the UI reads one enriched record per entry instead of hopping stores.
export interface SelectedViewEntry {
  entryId: string
  itemId: string
  name: string
  categoryId: string
  categoryName: string
  checked: boolean
  addedAt: number
}

export const $selectedView = computed(
  [$list, $catalog, $categories],
  (list, catalog, categories) => {
    const itemById = new Map(catalog.map((item) => [item.id, item]))
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
    return list.map((entry) => {
      const item = itemById.get(entry.itemId)
      const categoryId = item?.categoryId ?? UNCATEGORIZED_ID
      return {
        entryId: entry.id,
        itemId: entry.itemId,
        name: item?.name ?? "(unknown)",
        categoryId,
        categoryName: categoryNameById.get(categoryId) ?? UNCATEGORIZED_NAME,
        checked: entry.checked,
        addedAt: entry.addedAt,
      }
    })
  }
)

// Set of itemIds currently in the list, for O(1) membership checks in the
// catalog panel (e.g. marking rows that are already on the list).
export const $listItemIds = computed(
  $list,
  (list) => new Set(list.map((entry) => entry.itemId))
)
