import { useStore } from "@nanostores/react"
import { FolderPlusIcon, InfoIcon, PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { BackButton } from "@/components/back-button"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { CategorySection } from "@/components/catalog/category-section"
import { ItemDialog } from "@/components/catalog/item-dialog"
import { Button } from "@/components/ui/custom/button"
import { useIsMobile } from "@/hooks/use-is-mobile"
import {
  $catalogByCategoryAll,
  type CatalogByCategoryItem,
  type Category,
} from "@/stores"

const CatalogView = () => {
  const groups = useStore($catalogByCategoryAll)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemDialogCategoryId, setItemDialogCategoryId] = useState<
    string | undefined
  >(undefined)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogByCategoryItem | null>(
    null
  )
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const openAddItem = (categoryId?: string) => {
    setEditingItem(null)
    setItemDialogCategoryId(categoryId)
    setItemDialogOpen(true)
  }
  const openAddCategory = () => {
    setEditingCategory(null)
    setCategoryDialogOpen(true)
  }
  const openEditItem = (item: CatalogByCategoryItem) => {
    setEditingItem(item)
    setItemDialogCategoryId(item.categoryId)
    setItemDialogOpen(true)
  }
  const openEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryDialogOpen(true)
  }

  const isMobile = useIsMobile()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="font-bold text-2xl">Catalog</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openAddItem()}>
            <PlusIcon />
            Add item
          </Button>
          <Button onClick={openAddCategory}>
            <FolderPlusIcon />
            Add category
          </Button>
        </div>
      </div>

      {/* Legend: how to edit/delete, tailored to input modality */}
      <div className="flex gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-muted-foreground text-sm leading-relaxed">
        <InfoIcon
          weight="regular"
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <p className="min-w-0">
          {isMobile ? (
            <>
              <span className="font-medium text-foreground">Tap</span> a
              category or item name to edit it.{" "}
              <span className="font-medium text-foreground">Swipe</span> an item
              left to reveal{" "}
              <span className="font-medium text-foreground">Delete</span> (you
              will be asked to confirm). Categories are edited or deleted from
              the <span className="font-medium text-foreground">⋯</span> menu.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Double-click</span>{" "}
              a category or item name to edit. Use the{" "}
              <span className="font-medium text-foreground">⋯</span> menu for
              more actions. Deleting an item asks for confirmation and also
              removes it from your list; deleting a category moves its items to{" "}
              <span className="font-medium text-foreground">Uncategorized</span>
              . Press <span className="font-medium text-foreground">Enter</span>{" "}
              while focused to edit via keyboard.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <CategorySection
            key={group.categoryId}
            group={group}
            onAddItem={openAddItem}
            onEditCategory={openEditCategory}
            onEditItem={openEditItem}
          />
        ))}
      </div>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          setItemDialogOpen(open)
          if (!open) setEditingItem(null)
        }}
        editingItem={editingItem}
        defaultCategoryId={itemDialogCategoryId}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open)
          if (!open) setEditingCategory(null)
        }}
        editingCategory={editingCategory}
      />
    </div>
  )
}

export default CatalogView
