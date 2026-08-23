// Derived / computed views used by the main screen. Components stay dumb and
// read these instead of recomputing grouping logic themselves.

import { computed } from "nanostores"
import { $catalog } from "./catalog"
import { $categories } from "./categories"
import { $list } from "./list"
import type { CatalogItem, Category, ListEntry } from "./types"

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
