import { useStore } from "@nanostores/react"
import {
  DotsThreeIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/custom/button"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu"
import { useIsMobile } from "@/hooks/use-is-mobile"
import {
  $categories,
  type CatalogByCategoryAllGroup,
  type CatalogByCategoryItem,
  type Category,
  deleteCategoryWithReassign,
  UNCATEGORIZED_ID,
} from "@/stores"
import { CategoryFrequencyMenu } from "./category-frequency-menu"
import { CategoryItemsTable } from "./category-items-table"
import { ConfirmDelete } from "./confirm-delete"

interface CategorySectionProps {
  group: CatalogByCategoryAllGroup
  onAddItem: (categoryId: string) => void
  onEditCategory: (category: Category) => void
  onEditItem: (item: CatalogByCategoryItem) => void
}

// One category on the Catalog page: a Shark Collapsible whose header holds the
// double-click / tap editable name, the frequency picker, the item count, and
// the add/delete actions, and whose body is the items Table/List. The
// uncategorized sentinel is shown but cannot be renamed or deleted.
export const CategorySection = ({
  group,
  onAddItem,
  onEditCategory,
  onEditItem,
}: CategorySectionProps) => {
  const isUncategorized = group.categoryId === UNCATEGORIZED_ID
  const isMobile = useIsMobile()
  const categories = useStore($categories)
  const category = categories.find((c) => c.id === group.categoryId) ?? null

  const handleEditCategory = () => {
    if (isUncategorized || !category) return
    onEditCategory(category)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Collapsible defaultOpen>
          <div className="flex min-w-0 items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Toggle ${group.categoryName}`}
              >
                <CollapsibleIndicator />
              </Button>
            </CollapsibleTrigger>

            {/* Double-click on desktop, single tap on mobile to edit. */}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-bold text-lg hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64"
              aria-label={
                isUncategorized
                  ? group.categoryName
                  : `Edit ${group.categoryName} (double-click to edit)`
              }
              title={
                isUncategorized ? undefined : "Double-click to edit category"
              }
              disabled={isUncategorized}
              onClick={isMobile ? handleEditCategory : undefined}
              onDoubleClick={!isMobile ? handleEditCategory : undefined}
              onKeyDown={(e) => {
                if (isUncategorized) return
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleEditCategory()
                }
              }}
            >
              {group.categoryName}
            </button>

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
              className="h-7 shrink-0"
              aria-label={`${group.items.length} ${group.items.length === 1 ? "item" : "items"}`}
            >
              {group.items.length}
            </Badge>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Add item to ${group.categoryName}`}
                onClick={() => onAddItem(group.categoryId)}
              >
                <PlusIcon />
              </Button>

              {!isUncategorized && category && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`More actions for ${group.categoryName}`}
                    >
                      <DotsThreeIcon weight="bold" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem onClick={handleEditCategory} closeOnSelect>
                      <PencilSimpleIcon />
                      Edit category
                    </MenuItem>
                    <ConfirmDelete
                      title={`Delete "${group.categoryName}"?`}
                      description="Its items will be moved to Uncategorized. This cannot be undone."
                      confirmLabel="Delete category"
                      onConfirm={() =>
                        deleteCategoryWithReassign(group.categoryId)
                      }
                    >
                      <MenuItem
                        variant="destructive"
                        closeOnSelect={false}
                        onClick={(e) => e.preventDefault()}
                      >
                        <TrashIcon />
                        Delete category
                      </MenuItem>
                    </ConfirmDelete>
                  </MenuContent>
                </Menu>
              )}
            </div>
          </div>

          <CollapsibleContent>
            <CategoryItemsTable items={group.items} onEditItem={onEditItem} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
