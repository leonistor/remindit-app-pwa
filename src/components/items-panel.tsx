"use client"

import { useStore } from "@nanostores/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  $catalogByCategory,
  $listItemIds,
  $selectedView,
  addToList,
  removeFromList,
} from "@/stores"

export default function ItemsPanel({
  title = "All items",
}: {
  title?: string
}) {
  const groups = useStore($catalogByCategory)
  const selected = useStore($listItemIds)

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <h2 className="text-center font-bold text-base text-foreground">
        {title}
      </h2>
      <Accordion
        multiple
        defaultValue={groups.map((g) => g.categoryId)}
        className="mt-3 min-h-0 flex-1 overflow-y-auto"
      >
        {groups.map((group) => (
          <AccordionItem key={group.categoryId} value={group.categoryId}>
            <AccordionTrigger className="font-semibold text-xs uppercase tracking-wide">
              {group.categoryName}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const isSelected = selected.has(item.id)
                  return (
                    <Button
                      key={item.id}
                      variant={isSelected ? "outline" : "info"}
                      onClick={() =>
                        isSelected
                          ? (() => {
                              const entry = $selectedView
                                .get()
                                .find((e) => e.itemId === item.id)
                              if (entry) removeFromList(entry.entryId)
                            })()
                          : addToList(item.id)
                      }
                    >
                      {item.name}
                    </Button>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
