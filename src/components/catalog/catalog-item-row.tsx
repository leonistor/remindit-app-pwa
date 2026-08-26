import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item"
import { Button } from "@/components/ui/button"
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react"
import { ConfirmDelete } from "./confirm-delete"
import { removeCatalogItem, type CatalogByCategoryItem } from "@/stores"

interface CatalogItemRowProps {
  item: CatalogByCategoryItem
  onEdit: (item: CatalogByCategoryItem) => void
}

export const CatalogItemRow = ({ item, onEdit }: CatalogItemRowProps) => (
  <Item variant="outline">
    <ItemContent>
      <ItemTitle>{item.name}</ItemTitle>
    </ItemContent>
    <ItemActions>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${item.name}`}
        onClick={() => onEdit(item)}
      >
        <PencilSimpleIcon />
      </Button>
      <ConfirmDelete
        title={`Delete "${item.name}"?`}
        description="This removes the item from the catalog and from any active shopping list."
        confirmLabel="Delete"
        onConfirm={() => removeCatalogItem(item.id)}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${item.name}`}
        >
          <TrashIcon />
        </Button>
      </ConfirmDelete>
    </ItemActions>
  </Item>
)
