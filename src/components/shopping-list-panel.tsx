"use client"

import { useStore } from "@nanostores/react"
import { Button } from "@/components/ui/button"
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      <div className="flex min-h-0 flex-1 flex-wrap gap-2 overflow-y-auto">
        {selectedView.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nothing selected yet
          </p>
        ) : (
          selectedView.map((entry) => (
            <Button
              key={entry.entryId}
              variant="success"
              onClick={() => removeFromList(entry.entryId)}
            >
              {entry.name}
            </Button>
          ))
        )}
      </div>
    </div>
  )
}
