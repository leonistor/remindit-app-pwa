// Pure helpers that build the quick-add autocomplete source list. Extracted from
// quick-add-dialog.tsx so the recommendation/ordering logic can be unit-tested
// without rendering the dialog.

// Threshold of recommendations at which the dialog shows only recommended items.
export const RECS_ONLY_THRESHOLD = 10

// Sentinel category grouping the "create new item" affordance so it stays
// keyboard-navigable inside the same list collection as the catalog items.
export const NEW_CATEGORY_ID = "__new__"

// Value prefix that marks an option as the "create new item" suggestion (the
// label is the remainder of the value).
export const NEW_VALUE_PREFIX = "new:"

export interface QuickAddItem {
  value: string
  label: string
  categoryId: string
  categoryName: string
}

export interface QuickAddRecommendation {
  item: { id: string; name: string; categoryId: string }
  categoryName: string
  score: number
}

export interface QuickAddCatalogGroup {
  categoryId: string
  categoryName: string
  items: { id: string; name: string; categoryId: string }[]
}

// True when an autocomplete value represents the "create new item" affordance.
export function isNewValue(value: string): boolean {
  return value.startsWith(NEW_VALUE_PREFIX)
}

// Builds the autocomplete's source list, matching the available-items panel's
// category/item ordering (categories by frequency rank, items in catalog order).
//
// When `useRecommendedOnly`, the list is drawn from `recommendations` and
// grouped in category order (via `categoryRank`); otherwise it mirrors the full
// catalog groups.
export function buildItems(
  useRecommendedOnly: boolean,
  recommendations: QuickAddRecommendation[],
  catalogGroups: QuickAddCatalogGroup[],
  categoryRank: Map<string, number>
): QuickAddItem[] {
  if (useRecommendedOnly) {
    const byCategory = new Map<string, QuickAddItem[]>()
    for (const rec of recommendations) {
      const arr = byCategory.get(rec.item.categoryId) ?? []
      arr.push({
        value: rec.item.id,
        label: rec.item.name,
        categoryId: rec.item.categoryId,
        categoryName: rec.categoryName,
      })
      byCategory.set(rec.item.categoryId, arr)
    }
    // Preserve $categories order (frequency rank) so the dialog mirrors the
    // catalog panel; items within a category keep their recommendation score order.
    return categoryRank
      ? [...byCategory.entries()]
          .sort(
            ([a], [b]) =>
              (categoryRank.get(a) ?? 99) - (categoryRank.get(b) ?? 99)
          )
          .flatMap(([, items]) => items)
      : recommendations.map((rec) => ({
          value: rec.item.id,
          label: rec.item.name,
          categoryId: rec.item.categoryId,
          categoryName: rec.categoryName,
        }))
  }

  return catalogGroups.flatMap((group) =>
    group.items.map((item) => ({
      value: item.id,
      label: item.name,
      categoryId: item.categoryId,
      categoryName: group.categoryName,
    }))
  )
}
