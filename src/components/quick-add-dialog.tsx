import { useFilter, useListCollection } from "@ark-ui/react"
import { useStore } from "@nanostores/react"
import { useEffect, useMemo, useRef, useState } from "react"
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
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import {
  $catalogByCategory,
  $categories,
  $recommendations,
  addToList,
  createItemAndAddToList,
  UNCATEGORIZED_ID,
} from "@/stores"
import { frequencyRank } from "@/stores/types"
import {
  buildItems,
  isNewValue,
  NEW_CATEGORY_ID,
  NEW_VALUE_PREFIX,
  RECS_ONLY_THRESHOLD,
  type QuickAddItem,
} from "@/lib/quick-add"

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
    () =>
      buildItems(
        useRecommendedOnly,
        recommendations,
        catalogGroups,
        categoryRank
      ),
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
              value: `${NEW_VALUE_PREFIX}${trimmed}`,
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
      contentRef.current?.querySelector<HTMLInputElement>("input")?.focus()
    }, 120)
    return () => clearTimeout(id)
  }, [open])

  const commitAndClose = () => onOpenChange(false)

  const handleValueChange = (details: { value: string[] }) => {
    const selected = details.value[0]
    if (!selected) return
    if (isNewValue(selected)) {
      createItemAndAddToList(selected.slice(NEW_VALUE_PREFIX.length), UNCATEGORIZED_ID)
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
