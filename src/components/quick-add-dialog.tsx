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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  buildItems,
  isNewValue,
  NEW_CATEGORY_ID,
  NEW_VALUE_PREFIX,
  type QuickAddItem,
  RECS_ONLY_THRESHOLD,
} from "@/lib/quick-add"
import {
  $catalogByCategory,
  $categories,
  $recommendations,
  addToList,
  createItemAndAddToList,
  UNCATEGORIZED_ID,
} from "@/stores"
import { frequencyRank } from "@/stores/types"

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
  const [newItemCategoryId, setNewItemCategoryId] =
    useState<string>(UNCATEGORIZED_ID)
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
      setNewItemCategoryId(UNCATEGORIZED_ID)
      return
    }
    // Ensure the picker always starts on Uncategorized (or first category fallback).
    const hasUncategorized = categories.some(
      (c: { id: string }) => c.id === UNCATEGORIZED_ID
    )
    setNewItemCategoryId(
      hasUncategorized
        ? UNCATEGORIZED_ID
        : ((categories[0] as { id: string } | undefined)?.id ??
            UNCATEGORIZED_ID)
    )
    // Focus the input once the dialog content has mounted and the dialog's own
    // focus-on-open handling has settled.
    const id = window.setTimeout(() => {
      contentRef.current?.querySelector<HTMLInputElement>("input")?.focus()
    }, 120)
    return () => clearTimeout(id)
  }, [open, categories])

  const commitAndClose = () => onOpenChange(false)

  /** Create the current trimmed value as a new item in the chosen category. */
  const createNewItem = (overrideCategoryId?: string) => {
    if (trimmed.length < 3 || !canCreate) return false
    const rawTarget = overrideCategoryId ?? newItemCategoryId
    const targetCategoryId = categories.some(
      (c: { id: string }) => c.id === rawTarget
    )
      ? rawTarget
      : UNCATEGORIZED_ID
    createItemAndAddToList(trimmed, targetCategoryId)
    commitAndClose()
    return true
  }

  /** Direct creation from a category pill — one tap creates the new item. */
  const handleCategoryPillSelect = (categoryId: string) => {
    // Still enforce the ≥3 char rule and "is new" guard.
    if (trimmed.length < 3 || !canCreate) {
      // Not yet creatable: just remember the choice for the later Enter/Add tap.
      setNewItemCategoryId(categoryId)
      return
    }
    createNewItem(categoryId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && createNewItem()) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleValueChange = (details: { value: string[] }) => {
    const selected = details.value[0]
    if (!selected) return
    if (isNewValue(selected)) {
      const targetCategoryId = categories.some(
        (c: { id: string }) => c.id === newItemCategoryId
      )
        ? newItemCategoryId
        : UNCATEGORIZED_ID
      createItemAndAddToList(
        selected.slice(NEW_VALUE_PREFIX.length),
        targetCategoryId
      )
    } else if (baseItems.some((item) => item.value === selected)) {
      addToList(selected)
    } else {
      // Fallback for any other custom value (e.g. Enter on a free-typed name).
      const targetCategoryId = categories.some(
        (c: { id: string }) => c.id === newItemCategoryId
      )
        ? newItemCategoryId
        : UNCATEGORIZED_ID
      createItemAndAddToList(selected, targetCategoryId)
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
            onKeyDown={handleKeyDown}
          >
            <AutocompleteInput
              autoFocus
              size="lg"
              className="h-11 [&>input]:h-full [&>input]:w-full [&>input]:min-w-0 [&>input]:flex-1"
              placeholder="Add an item…"
              showClear
              onKeyDown={handleKeyDown}
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
              {canCreate && (
                <>
                  <Separator className="my-2" />
                  <div className="px-1 pb-1">
                    <p className="mb-1.5 px-1 font-medium text-muted-foreground text-xs">
                      Category for “{trimmed}”
                    </p>
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {categories.map((category) => {
                        const isSelected = category.id === newItemCategoryId
                        return (
                          <Badge
                            key={category.id}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            pill
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`Add “${trimmed}” to ${category.name}`}
                            className="cursor-pointer select-none"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleCategoryPillSelect(category.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                e.stopPropagation()
                                handleCategoryPillSelect(category.id)
                              }
                            }}
                            onMouseDown={(e) => {
                              // Prevent combobox from stealing focus / closing
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                          >
                            {category.name}
                          </Badge>
                        )
                      })}
                    </div>
                    <p className="mt-2 px-1 text-muted-foreground text-xs">
                      {trimmed.length >= 3
                        ? "Tap a category to create — or press Enter / “Add …”."
                        : "Type at least 3 letters, then tap a category or press Enter."}
                    </p>
                  </div>
                </>
              )}
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
