"use client"

import { createListCollection } from "@ark-ui/react"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  ListboxItemText,
} from "@/components/ui/listbox"

interface AllItemsExampleProps {
  title?: string
}

const AllItemsExample = ({ title = "example" }: AllItemsExampleProps) => (
  <Field className="w-full max-w-xl">
    <FieldLabel>{title}</FieldLabel>
    <Listbox
      collection={collection}
      orientation="horizontal"
      selectionMode="multiple"
    >
      <ListboxContent className="overflow-x-auto">
        {collection.items.map((item) => (
          <ListboxItem
            className="w-full flex-col items-start"
            item={item}
            key={item.title}
          >
            <div className="aspect-square size-20 w-full rounded-lg bg-foreground" />
            <div>
              <ListboxItemText>{item.title}</ListboxItemText>
              <p className="text-muted-foreground text-xs">{item.artist}</p>
            </div>
            <ListboxItemIndicator className="absolute top-4 right-4 shrink-0 rounded-sm bg-background [&_svg]:text-foreground!" />
          </ListboxItem>
        ))}
      </ListboxContent>
    </Listbox>
  </Field>
)

const collection = createListCollection({
  items: [
    { title: "Rappa Mundi", artist: "O Rappa" },
    { title: "Acústico MTV", artist: "Charlie Brown Jr." },
    { title: "Thriller", artist: "Michael Jackson" },
    { title: "The Eminem Show", artist: "Eminem" },
  ],
  itemToValue: (item) => item.title,
  itemToString: (item) => item.title,
})

export default AllItemsExample
