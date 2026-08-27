import { useStore } from "@nanostores/react"
import {
  $accordionOpen,
  $catalogByCategory,
  $listItemIds,
  $recommendationsByItemId,
  addToList,
  removeFromListByItemId,
  setAccordionOpen,
  type CatalogByCategoryGroup,
  type Recommendation,
} from "@/stores"

export interface UseCatalog {
  /** Catalog items grouped by category, in display order. */
  groups: CatalogByCategoryGroup[]
  /** Set of itemIds currently on the list (for selected-state). */
  selected: Set<string>
  /** Recommendations keyed by itemId (for the tier dot). */
  recommendationsByItemId: Map<string, Recommendation>
  /** Open accordion category ids (null = fall back to all open). */
  open: string[] | null
  /** Add an item to the list. */
  addToList: (itemId: string) => void
  /** Remove an item from the list by itemId. */
  removeFromListByItemId: (itemId: string) => void
  /** Persist the open accordion category ids. */
  setAccordionOpen: (ids: string[]) => void
}

// Feature hook for the catalog panel. Encapsulates the catalog/list/
// recommendation/accordion atoms so the panel only deals with derived data.
export function useCatalog(): UseCatalog {
  const groups = useStore($catalogByCategory)
  const selected = useStore($listItemIds)
  const recommendationsByItemId = useStore($recommendationsByItemId)
  const open = useStore($accordionOpen)
  return {
    groups,
    selected,
    recommendationsByItemId,
    open,
    addToList,
    removeFromListByItemId,
    setAccordionOpen,
  }
}
