import { useStore } from "@nanostores/react"
import {
  $selectedCategoriesVisible,
  $selectedOrdered,
  $selectedSort,
  removeFromList,
  toggleCategoriesVisible,
  toggleSelectedSort,
  type SelectedSort,
  type SelectedViewEntry,
} from "@/stores"

export interface UseShoppingList {
  /** Active list, ordered per the user's chosen sort. */
  items: SelectedViewEntry[]
  /** Whether category badges are shown on the selected-item chips. */
  categoriesVisible: boolean
  /** Active sort mode. */
  sort: SelectedSort
  /** Flip the category-badge visibility. */
  toggleCategoriesVisible: () => void
  /** Mutually-exclusive toggle of a sort mode. */
  toggleSelectedSort: (sort: SelectedSort) => void
  /** Remove a list entry by its id. */
  removeFromList: (entryId: string) => void
}

// Hides the raw shopping-list atoms behind a feature hook so views never import
// store internals directly, which keeps them easy to mock in tests.
export function useShoppingList(): UseShoppingList {
  const items = useStore($selectedOrdered)
  const categoriesVisible = useStore($selectedCategoriesVisible)
  const sort = useStore($selectedSort)
  return {
    items,
    categoriesVisible,
    sort,
    toggleCategoriesVisible,
    toggleSelectedSort,
    removeFromList,
  }
}
