import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { ItemButton } from "@/components/ui/custom/item-button"
import { useCatalog } from "@/hooks/use-catalog"
import { useItemTravelTransition } from "@/hooks/use-item-travel-transition"

export default function ItemCatalog() {
  const {
    groups,
    selected,
    recommendationsByItemId,
    recommendedCountByCategoryId,
    open,
    addToList,
    removeFromListByItemId,
    setAccordionOpen,
  } = useCatalog()
  const { runTravel } = useItemTravelTransition()
  // Fresh visit (no persisted toggle state): the first two categories open so
  // the panel reads as populated without overwhelming; afterwards the exact
  // set the user chose is persisted and wins over this fallback.
  const openValue = open ?? groups.slice(0, 2).map((group) => group.categoryId)

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      {/* The 2px hover ring draws outside each chip, so the scroll box needs
          breathing room or it clips at its edges. `-mx-1 px-1` widens the
          scroll box by 4px per side while padding keeps every trigger and chip
          at its previous position; AccordionContent gets the same -mx-1 so its
          own overflow-hidden clip edge moves out too — but because the chip
          grid stretches to fill that widened box, it needs a compensating
          `px-1` of its own or the chips stay flush with the clip edge. */}
      <Accordion
        multiple
        value={openValue}
        onValueChange={(details) => setAccordionOpen(details.value)}
        className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1"
      >
        {groups.map((group) => {
          // Store-derived and reactive: an item added to the list leaves the
          // recommendation set (badge drops); putting it back lands it in the
          // dotless "frequent" tier, so the badge stays down.
          const recommendedCount =
            recommendedCountByCategoryId.get(group.categoryId) ?? 0
          return (
            <AccordionItem key={group.categoryId} value={group.categoryId}>
              <AccordionTrigger className="font-semibold text-xs uppercase tracking-wide">
                {/* Wrapped so name + badge stay grouped on the trigger's left
                    side (justify-between would otherwise push them apart). */}
                <span className="flex items-center gap-2">
                  {group.categoryName}
                  {recommendedCount > 0 && (
                    <Badge variant="secondary" size="sm">
                      {recommendedCount}
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="-mx-1">
                {/* tm-stagger: chips cascade in once when the panel mounts on
                    open (50ms step under the calm profile). */}
                <div className="tm-stagger tm-stagger-50 flex flex-wrap gap-2 px-1 pt-2">
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
          )
        })}
      </Accordion>
    </div>
  )
}
