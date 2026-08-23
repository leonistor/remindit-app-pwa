"use client"

import { createListCollection } from "@ark-ui/react"
import { useStore } from "@nanostores/react"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemText,
} from "@/components/ui/listbox"
import { $selectedView, removeFromList } from "@/stores"

export interface ShoppingListPanelProps {
  /** Heading shown above the list. */
  title?: string
}

// Renders the active list ($selectedView) as an Ark UI Listbox. Each row is a
// "destructive" listbox item showing the item name (title) and its category
// name (subtitle). Clicking a row removes that entry from the list.
//
// The Listbox uses selectionMode="none" because rows are actions (remove), not
// selectable options; the user onClick still fires because Ark UI merges the
// internal and user handlers via mergeProps.
export const ShoppingListPanel = ({
  title = "Selected items",
}: ShoppingListPanelProps) => {
  const selectedView = useStore($selectedView)

  const collection = createListCollection({
    items: selectedView,
    itemToValue: (entry) => entry.entryId,
    itemToString: (entry) => entry.name,
  })

  return (
    <Field className="w-full">
      <FieldLabel>{title}</FieldLabel>
      <Listbox
        collection={collection}
        orientation="vertical"
        selectionMode="none"
      >
        <ListboxContent>
          {collection.items.map((entry) => (
            <ListboxItem
              item={entry}
              key={entry.entryId}
              variant="destructive"
              className="w-full items-center"
              onClick={() => removeFromList(entry.entryId)}
            >
              <ListboxItemText>{entry.name}</ListboxItemText>
              <p className="text-muted-foreground text-xs">
                {entry.categoryName}
              </p>
            </ListboxItem>
          ))}
        </ListboxContent>
      </Listbox>
    </Field>
  )
}
