import { PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/custom/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ItemGroup } from "@/components/ui/item"
import {
  type CatalogByCategoryAllGroup,
  type CatalogByCategoryItem,
  removeCategory,
  UNCATEGORIZED_ID,
} from "@/stores"
import { CatalogItemRow } from "./catalog-item-row"
import { ConfirmDelete } from "./confirm-delete"
import { FREQUENCY_LABELS } from "./frequency-labels"

interface CategoryCardProps {
  group: CatalogByCategoryAllGroup
  onEditItem: (item: CatalogByCategoryItem) => void
  onEditCategory: (group: CatalogByCategoryAllGroup) => void
  onAddItem: (categoryId: string) => void
}

export const CategoryCard = ({
  group,
  onEditItem,
  onEditCategory,
  onAddItem,
}: CategoryCardProps) => {
  const isUncategorized = group.categoryId === UNCATEGORIZED_ID

  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.categoryName}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {group.items.length} {group.items.length === 1 ? "item" : "items"}
          </Badge>
          {!isUncategorized && (
            <Badge variant="outline">{FREQUENCY_LABELS[group.frequency]}</Badge>
          )}
        </div>
        <CardAction className="flex items-center gap-2">
          {!isUncategorized && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${group.categoryName}`}
              onClick={() => onEditCategory(group)}
            >
              <PencilSimpleIcon />
            </Button>
          )}
          {!isUncategorized && (
            <ConfirmDelete
              title={`Delete "${group.categoryName}"?`}
              description="Its items will be moved to Uncategorized. This cannot be undone."
              confirmLabel="Delete category"
              onConfirm={() => removeCategory(group.categoryId)}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${group.categoryName}`}
              >
                <TrashIcon />
              </Button>
            </ConfirmDelete>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddItem(group.categoryId)}
          >
            <PlusIcon />
            Add item
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {group.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No items yet.</p>
        ) : (
          <ItemGroup>
            {group.items.map((item) => (
              <CatalogItemRow key={item.id} item={item} onEdit={onEditItem} />
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
