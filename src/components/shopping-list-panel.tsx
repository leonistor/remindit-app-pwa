import {
  ClockIcon,
  type Icon,
  ListBulletsIcon,
  PlusIcon,
  SortAscendingIcon,
  TextAaIcon,
} from "@phosphor-icons/react"
import { useCallback, useRef, useState } from "react"
import { QuickAddDialog } from "@/components/quick-add-dialog"
import { ShoppingItem } from "@/components/shopping-item"
import { Button } from "@/components/ui/custom/button"
import { Float } from "@/components/ui/float"
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"
import { useShoppingList } from "@/hooks/use-shopping-list"
import type { SelectedSort, SelectedViewEntry } from "@/stores"

// Icon + label per sort mode, mirroring the theme toggle's OPTIONS map. The
// single sort button renders the entry for the active mode.
const OPTIONS: Record<SelectedSort, { label: string; Icon: Icon }> = {
  default: { label: "Insertion order", Icon: ListBulletsIcon },
  "category-name": { label: "Category, then name", Icon: SortAscendingIcon },
  name: { label: "Name (A–Z)", Icon: TextAaIcon },
  "last-added": { label: "Last added first", Icon: ClockIcon },
}

// Renders the active list ($selectedOrdered) as color-coded item chips that
// wrap like the available-items grid in ItemCatalog. Each chip shows just the
// item name, tinted by its category color; clicking it removes that entry from
// the list.
//
// A single button in the top-right cycles the sort order (default → category +
// name → name only → last-added). The preference persists via the ui store.
export const ShoppingListPanel = () => {
  const {
    items: selectedView,
    sort,
    cycleSelectedSort,
    removeFromList,
  } = useShoppingList()
  const { runTravel, isSupported } = useItemTravelTransition()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
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

  const isEmpty = selectedView.length === 0
  const { label, Icon } = OPTIONS[sort]

  return (
    <div className="relative flex h-full min-h-0 flex-col px-4 py-3">
      <Float
        placement="top-end"
        // Cancel Float's corner-straddle (the panel clips overflow) and inset
        // the row just inside the top-right edge instead.
        className="!top-1 !inset-e-1 !translate-x-0 !-translate-y-0"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon-lg"
            aria-label={`Sort: ${label}. Click to change.`}
            title={`Sort: ${label}`}
            onClick={cycleSelectedSort}
          >
            <Icon size={16} aria-hidden />
          </Button>
          <Button
            variant="default"
            size="icon-lg"
            aria-label="Add to shopping list"
            onClick={() => setQuickAddOpen(true)}
          >
            <PlusIcon size={18} aria-hidden />
          </Button>
        </div>
      </Float>
      <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <div
        className={
          isEmpty
            ? "mt-3 flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 text-center text-muted-foreground text-sm"
            : "mt-3 flex min-h-0 flex-1 flex-wrap content-start justify-start gap-2 overflow-y-auto"
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
                  categoryId={entry.categoryId}
                  showCategory={false}
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
