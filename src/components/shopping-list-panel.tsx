"use client"

import { useStore } from "@nanostores/react"
import { useCallback, useRef, useState } from "react"
import { ShoppingItem } from "@/components/shopping-item"
import { $selectedView, removeFromList } from "@/stores"

export interface ShoppingListPanelProps {
  /** Heading shown above the list. */
  title?: string
}

// Renders the active list ($selectedView) as success-colored item chips that
// wrap like the available-items grid in ItemsPanel. Each chip shows just the
// item name; clicking it removes that entry from the list.
export const ShoppingListPanel = ({
  title = "Selected items",
}: ShoppingListPanelProps) => {
  const selectedView = useStore($selectedView)
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

  const isEmpty = selectedView.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <h2 className="text-center font-medium text-base text-foreground uppercase tracking-widest">
        {title}
      </h2>
      <div className="mt-3 flex min-h-0 flex-1 flex-wrap justify-start gap-2 overflow-y-auto">
        {isEmpty ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nothing selected yet
          </p>
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
