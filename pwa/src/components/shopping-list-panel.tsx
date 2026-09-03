import {
  ClockIcon,
  type Icon,
  ListBulletsIcon,
  PlusIcon,
  SortAscendingIcon,
  TextAaIcon,
} from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { QuickAddDialog } from "@/components/quick-add-dialog"
import { ShoppingItem } from "@/components/shopping-item"
import { Button } from "@/components/ui/custom/button"
import { Float } from "@/components/ui/float"
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"
import { useShoppingList } from "@/hooks/use-shopping-list"
import { m } from "@/paraglide/messages"
import type { SelectedSort, SelectedViewEntry } from "@/stores"

// Icon per sort mode, mirroring the theme toggle's OPTIONS map. The single
// sort button renders the entry for the active mode. Labels resolve from
// messages at render time — m.* must not be called at module scope (it would
// freeze the string at import, ignoring the active locale).
const OPTIONS: Record<SelectedSort, { Icon: Icon }> = {
  default: { Icon: ListBulletsIcon },
  "category-name": { Icon: SortAscendingIcon },
  name: { Icon: TextAaIcon },
  "last-added": { Icon: ClockIcon },
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

  // Clean up any pending animation timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of animationTimeouts.current.values()) {
        clearTimeout(timeout)
      }
      animationTimeouts.current.clear()
    }
  }, [])

  const handleRemove = useCallback(
    (entry: SelectedViewEntry, sourceEl: HTMLElement | null) => {
      // Prevent double-clicking during a transition/exit animation.
      if (animationTimeouts.current.has(entry.entryId)) return

      // When View Transitions are available, morph the chip back to the catalog.
      if (isSupported) {
        // Prevent double-click during VT animation (sentinel cleared on unmount)
        animationTimeouts.current.set(entry.entryId, setTimeout(() => {
          animationTimeouts.current.delete(entry.entryId)
        }, 500))
        runTravel(entry.itemId, sourceEl, () => {
          removeFromList(entry.entryId)
        })
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
  const { Icon } = OPTIONS[sort]
  const label = {
    default: m.sortDefault(),
    "category-name": m.sortCategoryName(),
    name: m.sortNameAZ(),
    "last-added": m.sortLastAdded(),
  }[sort]

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
            aria-label={m.sortButtonAriaLabel({ label })}
            title={m.sortButtonTitle({ label })}
            onClick={cycleSelectedSort}
          >
            <Icon size={16} aria-hidden />
          </Button>
          <Button
            variant="default"
            size="icon-lg"
            aria-label={m.addToShoppingList()}
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
            : // The 2px hover ring draws outside each chip, so the scroll box
              // needs breathing room or it clips at its edges. `-mx-1 px-1` +
              // `mt-2 pt-1` (8+4 = the old mt-3) and `pb-1` keep the chips at
              // their previous position while giving the ring 4px inside the
              // scroll box on every side.
              "-mx-1 mt-2 flex min-h-0 flex-1 flex-wrap content-start justify-start gap-2 overflow-y-auto px-1 pt-1 pb-1"
        }
      >
        {isEmpty ? (
          <p>{m.listEmptyHint()}</p>
        ) : (
          selectedView.map((entry) => {
            const isRemoving = removingIds.has(entry.entryId)
            return (
              <div
                key={entry.entryId}
                className={isRemoving ? "tm-scale-out" : "tm-scale-in"}
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
