import { useStore } from "@nanostores/react"
import {
  $selectedOrdered,
  $selectedSort,
  removeFromList,
  type SelectedSort,
  type SelectedViewEntry,
  toggleSelectedSort,
} from "@/stores"

export interface UseShoppingList {
  /** Active list, ordered per the user's chosen sort. */
  items: SelectedViewEntry[]
  /** Active sort mode. */
  sort: SelectedSort
  /** Mutually-exclusive toggle of a sort mode. */
  toggleSelectedSort: (sort: SelectedSort) => void
  /** Remove a list entry by its id. */
  removeFromList: (entryId: string) => void
}

// Hides the raw shopping-list atoms behind a feature hook so views never import
// store internals directly, which keeps them easy to mock in tests.
export function useShoppingList(): UseShoppingList {
  const items = useStore($selectedOrdered)
  const sort = useStore($selectedSort)
  return {
    items,
    sort,
    toggleSelectedSort,
    removeFromList,
  }
}
