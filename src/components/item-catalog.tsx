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
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"
import { LEGEND_TIERS, RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"
import { useCatalog } from "@/stores"

export default function ItemCatalog() {
  const {
    groups,
    selected,
    recommendationsByItemId,
    open,
    addToList,
    removeFromListByItemId,
    setAccordionOpen,
  } = useCatalog()
  const { runTravel } = useItemTravelTransition()
  const openValue = open ?? groups.map((g) => g.categoryId)

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="relative flex items-center justify-center">
        <ToggleTooltip>
          <ToggleTooltipTrigger asChild>
            <Button
              aria-label="Recommendation colour codes"
              size="icon-sm"
              variant="ghost"
              className="absolute end-0.5 top-[52.5%] -translate-y-1/2"
            >
              <InfoIcon aria-hidden />
            </Button>
          </ToggleTooltipTrigger>
          <ToggleTooltipContent className="max-w-56">
            <p className="font-medium">Recommendation codes</p>
            <div className="mt-2 flex flex-col gap-2">
              {LEGEND_TIERS.map((tier) => (
                <div key={tier} className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${RECOMMENDATION_TIERS[tier].dotColor}`}
                    aria-hidden
                  />
                  <span>
                    {RECOMMENDATION_TIERS[tier].label} —{" "}
                    {RECOMMENDATION_TIERS[tier].description}
                  </span>
                </div>
              ))}
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
                      categoryKey={group.categoryId}
                      isSelected={isSelected}
                      recommendationTier={
                        recommendationsByItemId.get(item.id)?.tier
                      }
                      travelTargetId={item.id}
                      onClick={(e) => {
                        // When removing, the visible "from" is the list chip
                        // (even though we clicked the catalog button), so it
                        // animates out of the shopping list rather than snapping.
                        const sourceEl = isSelected
                          ? (document.querySelector<HTMLElement>(
                              `[data-vt-list="${item.id}"]`
                            ) ?? e.currentTarget)
                          : e.currentTarget
                        runTravel(item.id, sourceEl, () =>
                          isSelected
                            ? removeFromListByItemId(item.id)
                            : addToList(item.id)
                        )
                      }}
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
