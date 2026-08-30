import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ItemButton } from "@/components/ui/custom/item-button"
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"
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
