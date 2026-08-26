"use client"

import { useStore } from "@nanostores/react"
import { ClockIcon, SortAscendingIcon, TagIcon } from "@phosphor-icons/react"
import { useCallback, useRef, useState } from "react"
import { ShoppingItem } from "@/components/shopping-item"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  $selectedCategoriesVisible,
  $selectedOrdered,
  $selectedSort,
  removeFromList,
  type SelectedSort,
  setSelectedCategoriesVisible,
  setSelectedSort,
} from "@/stores"

// Renders the active list ($selectedOrdered) as success-colored item chips that
// wrap like the available-items grid in ItemCatalog. Each chip shows just the
// item name; clicking it removes that entry from the list.
//
// A ToggleGroup above the list drives display + ordering: an independent
// show/hide-categories toggle and two mutually exclusive sort modes (category +
// name, or last-added-first). Preferences persist via the ui store.
export const ShoppingListPanel = () => {
  const selectedView = useStore($selectedOrdered)
  const categoriesVisible = useStore($selectedCategoriesVisible)
  const sort = useStore($selectedSort)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const animationTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const handleRemove = useCallback((entryId: string) => {
    // Prevent double-clicking during animation
    if (animationTimeouts.current.has(entryId)) return

    // Mark entry as removing (triggers exit animation)
    setRemovingIds((prev) => new Set(prev).add(entryId))

    // After animation completes, remove from store and clear the removing state
    const timeout = setTimeout(() => {
      removeFromList(entryId)
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(entryId)
        return next
      })
      animationTimeouts.current.delete(entryId)
    }, 150)

    animationTimeouts.current.set(entryId, timeout)
  }, [])

  // Build the controlled ToggleGroup value from the two pieces of UI state.
  const groupValue = [
    categoriesVisible ? "categories" : "",
    sort !== "default" ? sort : "",
  ].filter(Boolean)

  const handleGroupChange = useCallback((details: { value: string[] }) => {
    const next = new Set(details.value)
    setSelectedCategoriesVisible(next.has("categories"))

    const activeSorts = (
      ["category-name", "last-added"] as SelectedSort[]
    ).filter((s) => next.has(s))
    if (activeSorts.length === 0) {
      setSelectedSort("default")
      return
    }
    if (activeSorts.length === 1) {
      setSelectedSort(activeSorts[0])
      return
    }
    // Both sort toggles on at once — the newly clicked one is the opposite of
    // the previously active sort, so switch to that.
    const previouslyActive = $selectedSort.get()
    setSelectedSort(
      activeSorts.find((s) => s !== previouslyActive) ?? activeSorts[0]
    )
  }, [])

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
                  showCategory={categoriesVisible}
                  onClick={() => handleRemove(entry.entryId)}
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
