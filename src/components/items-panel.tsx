"use client"

import { useStore } from "@nanostores/react"
import { InfoIcon } from "@phosphor-icons/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/custom/button"
import { ItemButton } from "@/components/ui/custom/item-button"
import {
  ToggleTooltip,
  ToggleTooltipContent,
  ToggleTooltipTrigger,
} from "@/components/ui/custom/toggle-tooltip"
import {
  $accordionOpen,
  $catalogByCategory,
  $listItemIds,
  $recommendations,
  $selectedView,
  addToList,
  removeFromList,
  setAccordionOpen,
} from "@/stores"
import type { RecommendationTier } from "@/stores/types"

export default function ItemsPanel({
  title = "All items",
}: {
  title?: string
}) {
  const groups = useStore($catalogByCategory)
  const selected = useStore($listItemIds)
  const recommendations = useStore($recommendations)
  const open = useStore($accordionOpen)
  const openValue = open ?? groups.map((g) => g.categoryId)

  const tierByItemId = new Map<string, RecommendationTier>()
  for (const rec of recommendations) {
    tierByItemId.set(rec.item.id, rec.tier)
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="relative flex items-center justify-center">
        <h2 className="text-center font-medium text-base text-foreground uppercase tracking-widest">
          {title}
        </h2>
        <ToggleTooltip>
          <ToggleTooltipTrigger asChild>
            <Button
              aria-label="Recommendation colour codes"
              size="icon-sm"
              variant="ghost"
              className="absolute end-0 top-1/2 -translate-y-1/2"
            >
              <InfoIcon aria-hidden />
            </Button>
          </ToggleTooltipTrigger>
          <ToggleTooltipContent className="max-w-56">
            <p className="font-medium">Recommendation codes</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-destructive"
                  aria-hidden
                />
                <span>Overdue — past its usual buy date</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-warning" aria-hidden />
                <span>Soon — due for repurchase soon</span>
              </div>
            </div>
          </ToggleTooltipContent>
        </ToggleTooltip>
      </div>
      <Accordion
        multiple
        value={openValue}
        onValueChange={(details) => setAccordionOpen(details.value)}
        className="mt-3 min-h-0 flex-1 overflow-y-auto"
      >
        {groups.map((group) => (
          <AccordionItem key={group.categoryId} value={group.categoryId}>
            <AccordionTrigger className="font-semibold text-xs uppercase tracking-wide">
              {group.categoryName}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2 pt-2">
                {group.items.map((item) => {
                  const isSelected = selected.has(item.id)
                  return (
                    <ItemButton
                      key={item.id}
                      name={item.name}
                      purpose="selectable"
                      isSelected={isSelected}
                      recommendationTier={tierByItemId.get(item.id)}
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
                    />
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
