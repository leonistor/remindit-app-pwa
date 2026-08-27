// Derived / computed views used by the main screen. Components stay dumb and
// read these instead of recomputing grouping logic themselves.

import { type ReadableAtom, computed } from "nanostores"
import { $catalog } from "./catalog"
import { $categories } from "./categories"
import { $history } from "./history"
import { $list } from "./list"
import { computeRecommendations } from "./recommender"
import type {
  CatalogItem,
  Category,
  CategoryFrequency,
  ListEntry,
} from "./types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "./types"
import { $selectedSort } from "./ui"

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

// $selectedView reordered per the user's chosen sort ($selectedSort). "default"
// keeps list insertion order; the two sort modes are mutually exclusive in the
// UI. Components that need the raw, unsorted list read $selectedView directly.
export const $selectedOrdered = computed(
  [$selectedView, $selectedSort],
  (view, sort) => {
    if (sort === "default") return view
    const copy = [...view]
    if (sort === "category-name") {
      copy.sort((a, b) => {
        const byCategory = a.categoryName.localeCompare(b.categoryName)
        return byCategory !== 0 ? byCategory : a.name.localeCompare(b.name)
      })
    } else {
      // "last-added" — most recently added first.
      copy.sort((a, b) => b.addedAt - a.addedAt)
    }
    return copy
  }
)

// Set of itemIds currently in the list, for O(1) membership checks in the
// catalog panel (e.g. marking rows that are already on the list).
export const $listItemIds = computed(
  $list,
  (list) => new Set(list.map((entry) => entry.itemId))
)

// A single catalog item grouped under its category, stripped down to the fields
// the ItemsPanel AccordionItem needs to render a button.
export interface CatalogByCategoryItem {
  id: string
  name: string
  /** The item's category — needed by the management UI to pre-select it. */
  categoryId: string
}

// Like $catalogByCategory but includes EVERY category in $categories order —
// even empty ones and the "uncategorized" sentinel — so the management UI can
// show, edit, and add into categories that currently hold no items.
export interface CatalogByCategoryAllGroup {
  categoryId: string
  categoryName: string
  frequency: CategoryFrequency
  items: CatalogByCategoryItem[]
}

export const $catalogByCategoryAll = computed(
  [$catalogView, $categories],
  (view, categories): CatalogByCategoryAllGroup[] => {
    const itemsByCategoryId = new Map<string, CatalogByCategoryItem[]>()
    for (const item of view) {
      let group = itemsByCategoryId.get(item.categoryId)
      if (!group) {
        group = []
        itemsByCategoryId.set(item.categoryId, group)
      }
      group.push({ id: item.id, name: item.name, categoryId: item.categoryId })
    }

    return categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      frequency: category.frequency,
      items: itemsByCategoryId.get(category.id) ?? [],
    }))
  }
)

// Catalog items grouped by category. Backs the refactored ItemsPanel, which
// renders one AccordionItem per category containing that category's items.
// Categories appear in first-appearance order and only when they hold at least
// one item; the categoryName comes from the items themselves.
export interface CatalogByCategoryGroup {
  categoryId: string
  categoryName: string
  items: CatalogByCategoryItem[]
}

export const $catalogByCategory = computed(
  $catalogView,
  (view): CatalogByCategoryGroup[] => {
    const groupByCategoryId = new Map<
      string,
      { categoryName: string; items: CatalogByCategoryItem[] }
    >()

    for (const item of view) {
      let group = groupByCategoryId.get(item.categoryId)
      if (!group) {
        group = { categoryName: item.categoryName, items: [] }
        groupByCategoryId.set(item.categoryId, group)
      }
      group.items.push({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
      })
    }

    const result: CatalogByCategoryGroup[] = []
    for (const [categoryId, group] of groupByCategoryId) {
      if (group.items.length === 0) continue
      result.push({
        categoryId,
        categoryName: group.categoryName,
        items: group.items,
      })
    }
    return result
  }
)

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

// Recomputed whenever history, catalog, categories, or the active list change.
// Items on the active list and "seldom"-frequency items are always excluded.
export const $recommendations = computed(
  [$history, $catalog, $categories, $list],
  (history, catalog, categories, list) =>
    computeRecommendations(history, catalog, categories, list)
)

// Item-id → recommendation lookup, so catalog views can read a tier in O(1)
// instead of rebuilding a `.find()` map on every render.
export const $recommendationsByItemId = computed(
  $recommendations,
  (recommendations) =>
    new Map(recommendations.map((rec) => [rec.item.id, rec]))
)

// A per-item detail selector. Components call `$itemDetail(itemId)` to get a
// store yielding `{ item, categoryName }`, replacing inline `.find()` joins.
// Each itemId gets one memoized computed so re-renders don't rebuild atoms.
export interface ItemDetail {
  item: CatalogItem | null
  categoryName: string
}

const $itemDetailCache = new Map<string, ReadableAtom<ItemDetail>>()

// `computed` needs its dependency list, so null is cached under a sentinel key
// and the lookup is guarded inside the callback.
const NULL_ID = ""

export function $itemDetail(itemId: string | null) {
  const key = itemId ?? NULL_ID
  let store = $itemDetailCache.get(key)
  if (!store) {
    store = computed<ItemDetail>([$catalog, $categories], (catalog, categories) => {
      if (itemId === null) return { item: null, categoryName: "" }
      const item = catalog.find((i) => i.id === itemId) ?? null
      if (!item) return { item: null, categoryName: "" }
      const categoryName =
        categories.find((c) => c.id === item.categoryId)?.name ??
        UNCATEGORIZED_NAME
      return { item, categoryName }
    })
    $itemDetailCache.set(key, store)
  }
  return store
}

export type { Recommendation, RecommendationTier } from "./types"
