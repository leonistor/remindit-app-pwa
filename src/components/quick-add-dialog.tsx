import { useEffect, useMemo, useRef, useState } from "react"
import { useFilter, useListCollection } from "@ark-ui/react"
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/custom/button"
import {
  $catalogByCategory,
  $categories,
  $recommendations,
  addToList,
  createItemAndAddToList,
  UNCATEGORIZED_ID,
} from "@/stores"
import { useStore } from "@nanostores/react"
import { frequencyRank } from "@/stores/types"

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Threshold of recommendations before the dialog shows only recommended items.
const RECS_ONLY_THRESHOLD = 10

// Sentinel category grouping the "create new item" affordance so it stays
// keyboard-navigable inside the same list collection as the catalog items.
const NEW_CATEGORY_ID = "__new__"

interface QuickAddItem {
  value: string
  label: string
  categoryId: string
  categoryName: string
}

// Builds the autocomplete's source list, matching the available-items panel's
// category/item ordering (categories by frequency rank, items in catalog order).
function buildItems(
  useRecommendedOnly: boolean,
  recommendations: { item: { id: string; name: string; categoryId: string }; categoryName: string; score: number }[],
  catalogGroups: { categoryId: string; categoryName: string; items: { id: string; name: string; categoryId: string }[] }[],
  categoryRank: Map<string, number>
): QuickAddItem[] {
  if (useRecommendedOnly) {
    const byCategory = new Map<string, QuickAddItem[]>()
    for (const rec of recommendations) {
      const arr = byCategory.get(rec.item.categoryId) ?? []
      arr.push({
        value: rec.item.id,
        label: rec.item.name,
        categoryId: rec.item.categoryId,
        categoryName: rec.categoryName,
      })
      byCategory.set(rec.item.categoryId, arr)
    }
    // Preserve $categories order (frequency rank) so the dialog mirrors the
    // catalog panel; items within a category keep their recommendation score order.
    return categoryRank
      ? [...byCategory.entries()]
          .sort(
            ([a], [b]) =>
              (categoryRank.get(a) ?? 99) - (categoryRank.get(b) ?? 99)
          )
          .flatMap(([, items]) => items)
      : recommendations.map((rec) => ({
          value: rec.item.id,
          label: rec.item.name,
          categoryId: rec.item.categoryId,
          categoryName: rec.categoryName,
        }))
  }

  return catalogGroups.flatMap((group) =>
    group.items.map((item) => ({
      value: item.id,
      label: item.name,
      categoryId: item.categoryId,
      categoryName: group.categoryName,
    }))
  )
}

export function QuickAddDialog({ open, onOpenChange }: QuickAddDialogProps) {
  const recommendations = useStore($recommendations)
  const catalogGroups = useStore($catalogByCategory)
  const categories = useStore($categories)

  const [inputValue, setInputValue] = useState("")
  const [value, setValue] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  const useRecommendedOnly = recommendations.length >= RECS_ONLY_THRESHOLD

  const categoryRank = useMemo(
    () => new Map(categories.map((c) => [c.id, frequencyRank(c.frequency)])),
    [categories]
  )

  const baseItems = useMemo(
    () => buildItems(useRecommendedOnly, recommendations, catalogGroups, categoryRank),
    [useRecommendedOnly, recommendations, catalogGroups, categoryRank]
  )

  const { contains } = useFilter({ sensitivity: "base" })

  // When the typed value matches no existing item, offer a "create" action.
  const trimmed = inputValue.trim()
  const exactMatch = baseItems.some(
    (item) => item.label.toLowerCase() === trimmed.toLowerCase()
  )
  const canCreate = trimmed.length > 0 && !exactMatch

  const allItems = useMemo<QuickAddItem[]>(
    () =>
      canCreate
        ? [
            ...baseItems,
            {
              value: `new:${trimmed}`,
              label: trimmed,
              categoryId: NEW_CATEGORY_ID,
              categoryName: "Add new",
            },
          ]
        : baseItems,
    [baseItems, canCreate, trimmed]
  )

  const { collection, filter, set } = useListCollection<QuickAddItem>({
    initialItems: allItems,
    filter: contains,
    groupBy: (item) => item.categoryId,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
  })

  // Keep the collection in sync with the source list and the current filter.
  useEffect(() => {
    set(allItems)
    filter(inputValue)
  }, [allItems, filter, inputValue, set])

  // Reset transient state whenever the dialog is closed.
  useEffect(() => {
    if (!open) {
      setInputValue("")
      setValue([])
      return
    }
    // Focus the input once the dialog content has mounted and the dialog's own
    // focus-on-open handling has settled.
    const id = window.setTimeout(() => {
      contentRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus()
    }, 120)
    return () => clearTimeout(id)
  }, [open])

  const commitAndClose = () => onOpenChange(false)

  const handleValueChange = (details: { value: string[] }) => {
    const selected = details.value[0]
    if (!selected) return
    if (selected.startsWith("new:")) {
      createItemAndAddToList(selected.slice(4), UNCATEGORIZED_ID)
    } else if (baseItems.some((item) => item.value === selected)) {
      addToList(selected)
    } else {
      // Fallback for any other custom value (e.g. Enter on a free-typed name).
      createItemAndAddToList(selected, UNCATEGORIZED_ID)
    }
    commitAndClose()
  }

  const groups = collection.group()

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent ref={contentRef}>
        <DialogHeader
          description="Search the catalog or type to add something new."
          title="Quick add"
        />
        <DialogBody>
          <Autocomplete
            collection={collection}
            value={value}
            onValueChange={handleValueChange}
            inputValue={inputValue}
            onInputValueChange={(details) => setInputValue(details.inputValue)}
          >
            <AutocompleteInput
              autoFocus
              size="lg"
              className="h-11 [&>input]:h-full [&>input]:w-full [&>input]:min-w-0 [&>input]:flex-1"
              placeholder="Add an item…"
              showClear
            />
            <AutocompleteContent>
              <AutocompleteEmpty>No items found.</AutocompleteEmpty>
              <AutocompleteList>
                {groups.map(([key, items]) => {
                  const heading =
                    key === NEW_CATEGORY_ID
                      ? "Add new"
                      : (items[0]?.categoryName ?? "")
                  return (
                    <AutocompleteGroup key={key} id={key}>
                      <AutocompleteGroupLabel>{heading}</AutocompleteGroupLabel>
                      {items.map((item) => (
                        <AutocompleteItem
                          key={item.value}
                          item={item}
                          showIndicator={item.categoryId !== NEW_CATEGORY_ID}
                        >
                          {item.categoryId === NEW_CATEGORY_ID
                            ? `Add “${item.label}”`
                            : item.label}
                        </AutocompleteItem>
                      ))}
                    </AutocompleteGroup>
                  )
                })}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>

          {!useRecommendedOnly && (
            <p className="mt-3 text-muted-foreground text-xs">
              Add at least {RECS_ONLY_THRESHOLD} items to unlock personalized
              recommendations — type a name that isn&apos;t listed to create it.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
