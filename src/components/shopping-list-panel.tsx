import { ClockIcon, SortAscendingIcon, TagIcon } from "@phosphor-icons/react"
import { useCallback, useRef, useState } from "react"
import { ShoppingItem } from "@/components/shopping-item"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"
import {
  type SelectedSort,
  type SelectedViewEntry,
  useShoppingList,
} from "@/stores"

// Renders the active list ($selectedOrdered) as success-colored item chips that
// wrap like the available-items grid in ItemCatalog. Each chip shows just the
// item name; clicking it removes that entry from the list.
//
// A ToggleGroup above the list drives display + ordering: an independent
// show/hide-categories toggle and two mutually exclusive sort modes (category +
// name, or last-added-first). Preferences persist via the ui store.
export const ShoppingListPanel = () => {
  const {
    items: selectedView,
    categoriesVisible,
    sort,
    toggleCategoriesVisible,
    toggleSelectedSort,
    removeFromList,
  } = useShoppingList()
  const { runTravel, isSupported } = useItemTravelTransition()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const animationTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const handleRemove = useCallback(
    (entry: SelectedViewEntry, sourceEl: HTMLElement | null) => {
      // Prevent double-clicking during a transition/exit animation.
      if (animationTimeouts.current.has(entry.entryId)) return

      // When View Transitions are available, morph the chip back to the catalog.
      if (isSupported) {
        runTravel(entry.itemId, sourceEl, () => removeFromList(entry.entryId))
        return
      }

      // Fallback for unsupported browsers: play the CSS exit animation, then
      // remove the entry from the store.
      setRemovingIds((prev) => new Set(prev).add(entry.entryId))
      const timeout = setTimeout(() => {
        removeFromList(entry.entryId)
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(entry.entryId)
          return next
        })
        animationTimeouts.current.delete(entry.entryId)
      }, 150)
      animationTimeouts.current.set(entry.entryId, timeout)
    },
    [removeFromList, runTravel, isSupported]
  )

  // Build the controlled ToggleGroup value from the two pieces of UI state.
  const groupValue = [
    categoriesVisible ? "categories" : "",
    sort !== "default" ? sort : "",
  ].filter(Boolean)

  // The ToggleGroup reports the full resulting value set on each toggle. We
  // diff it against the current store values (no `.get()` reads needed) and
  // delegate the flip to the ui store, which owns the sort state machine.
  const handleGroupChange = useCallback(
    (details: { value: string[] }) => {
      const next = new Set(details.value)
      if (next.has("categories") !== categoriesVisible)
        toggleCategoriesVisible()

      const SORTS: SelectedSort[] = ["category-name", "last-added"]
      const clickedSort = SORTS.find((s) => next.has(s) && s !== sort)
      if (clickedSort) {
        toggleSelectedSort(clickedSort)
      } else if (!next.has(sort) && sort !== "default") {
        // The active sort was just toggled off.
        toggleSelectedSort(sort)
      }
    },
    [categoriesVisible, sort, toggleCategoriesVisible, toggleSelectedSort]
  )

  const isEmpty = selectedView.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="relative flex items-center justify-center">
        <ToggleGroup
          multiple
          variant="ghost"
          size="sm"
          value={groupValue}
          onValueChange={handleGroupChange}
          className="absolute end-0.5 top-1/2 -translate-y-1/2"
          aria-label="Selected items display and ordering"
        >
          <ToggleGroupItem
            value="categories"
            aria-label="Show or hide categories"
            title="Show/hide categories"
          >
            <TagIcon aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="category-name"
            aria-label="Sort by category then item name"
            title="Sort by category, then name"
          >
            <SortAscendingIcon aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="last-added"
            aria-label="Sort by last added first"
            title="Sort by last added first"
          >
            <ClockIcon aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        className={
          isEmpty
            ? "mt-3 flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 text-center text-muted-foreground text-sm"
            : "mt-3 flex min-h-0 flex-1 flex-wrap justify-start gap-2 overflow-y-auto"
        }
      >
        {isEmpty ? (
          <p>Tap items below to add to the shopping list.</p>
        ) : (
          selectedView.map((entry) => {
            const isRemoving = removingIds.has(entry.entryId)
            return (
              <div
                key={entry.entryId}
                className={
                  isRemoving
                    ? "fade-out zoom-out-95 animate-out duration-150"
                    : "fade-in zoom-in-95 animate-in duration-200"
                }
              >
                <ShoppingItem
                  name={entry.name}
                  categoryName={entry.categoryName}
                  categoryId={entry.categoryId}
                  showCategory={categoriesVisible}
                  travelTargetId={entry.itemId}
                  onClick={(e) => handleRemove(entry, e.currentTarget)}
                  disabled={isRemoving}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
