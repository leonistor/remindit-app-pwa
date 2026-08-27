import { PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/custom/button"
import {
  type CatalogByCategoryAllGroup,
  removeCategory,
  renameCategory,
  UNCATEGORIZED_ID,
} from "@/stores"
import { CategoryFrequencyMenu } from "./category-frequency-menu"
import { CategoryItemsTable } from "./category-items-table"
import { ConfirmDelete } from "./confirm-delete"
import { InlineEditableName } from "./inline-editable-name"

interface CategorySectionProps {
  group: CatalogByCategoryAllGroup
  onAddItem: (categoryId: string) => void
}

// One category on the Catalog page: a Shark Collapsible whose header holds the
// inline-editable name, the frequency picker, the item count, and the add/delete
// actions, and whose body is the items Table. The uncategorized sentinel is
// shown but cannot be renamed or deleted.
export const CategorySection = ({ group, onAddItem }: CategorySectionProps) => {
  const isUncategorized = group.categoryId === UNCATEGORIZED_ID

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Collapsible defaultOpen>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Toggle ${group.categoryName}`}
              >
                <CollapsibleIndicator />
              </Button>
            </CollapsibleTrigger>

            <InlineEditableName
              value={group.categoryName}
              onCommit={(next) => renameCategory(group.categoryId, next)}
              disabled={isUncategorized}
              ariaLabel={`Rename ${group.categoryName}`}
              placeholder="Unnamed category"
              variant="bare"
              className="font-bold text-lg"
            />

            {!isUncategorized && (
              <CategoryFrequencyMenu
                categoryId={group.categoryId}
                categoryName={group.categoryName}
                frequency={group.frequency}
              />
            )}

            <Badge
              variant="outline"
              size="sm"
              className="h-7"
              aria-label={`${group.items.length} ${group.items.length === 1 ? "item" : "items"}`}
            >
              {group.items.length}
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Add item"
                onClick={() => onAddItem(group.categoryId)}
              >
                <PlusIcon />
              </Button>
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
            </div>
          </div>

          <CollapsibleContent>
            <CategoryItemsTable items={group.items} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
