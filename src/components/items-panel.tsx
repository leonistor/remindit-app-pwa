"use client"

import { createListCollection } from "@ark-ui/react"
import { useStore } from "@nanostores/react"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
} from "@/components/ui/listbox"
import { $catalogView, $listItemIds, addToList } from "@/stores"

export default function ItemsPanel({
  title = "All items",
}: {
  title?: string
}) {
  const items = useStore($catalogView)
  const selected = useStore($listItemIds)
  const collection = createListCollection({
    items,
    itemToValue: (i) => i.id,
    itemToString: (i) => i.name,
  })
  return (
    <Field className="w-full">
      <FieldLabel>{title}</FieldLabel>
      <Listbox
        collection={collection}
        orientation="horizontal"
        selectionMode="none"
      >
        <ListboxContent className="flex flex-wrap gap-2">
          {collection.items.map((item) => (
            <ListboxItem
              item={item}
              key={item.id}
              className="relative w-36 flex-col items-start"
              onClick={() => addToList(item.id)}
            >
              <div className="aspect-square size-20 w-full rounded-lg bg-foreground" />
              <div>
                <ListboxItemText>{item.name}</ListboxItemText>
                <p className="text-muted-foreground text-xs">
                  {item.categoryName}
                </p>
              </div>
              {selected.has(item.id) && (
                <ListboxItemIndicator className="absolute top-4 right-4 shrink-0 rounded-sm bg-background [&_svg]:text-foreground!" />
              )}
            </ListboxItem>
          ))}
        </ListboxContent>
      </Listbox>
    </Field>
  )
}
