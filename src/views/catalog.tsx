import { useStore } from "@nanostores/react"
import { FolderPlusIcon, PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { CategoryCard } from "@/components/catalog/category-card"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { ItemDialog } from "@/components/catalog/item-dialog"
import { Button } from "@/components/ui/button"
import {
  $catalogByCategoryAll,
  type CatalogByCategoryAllGroup,
  type CatalogByCategoryItem,
  type Category,
} from "@/stores"

interface ItemDialogState {
  open: boolean
  editing: CatalogByCategoryItem | null
  defaultCategoryId?: string
}

interface CategoryDialogState {
  open: boolean
  editing: Category | null
}

const CatalogView = () => {
  const groups = useStore($catalogByCategoryAll)

  const [itemDialog, setItemDialog] = useState<ItemDialogState>({
    open: false,
    editing: null,
  })
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({
    open: false,
    editing: null,
  })

  const openAddItem = (categoryId?: string) =>
    setItemDialog({ open: true, editing: null, defaultCategoryId: categoryId })
  const openEditItem = (item: CatalogByCategoryItem) =>
    setItemDialog({ open: true, editing: item })
  const openAddCategory = () => setCategoryDialog({ open: true, editing: null })
  const openEditCategory = (group: CatalogByCategoryAllGroup) =>
    setCategoryDialog({
      open: true,
      editing: {
        id: group.categoryId,
        name: group.categoryName,
        frequency: group.frequency,
      },
    })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">Catalog</h1>
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

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <CategoryCard
            key={group.categoryId}
            group={group}
            onEditItem={openEditItem}
            onEditCategory={openEditCategory}
            onAddItem={openAddItem}
          />
        ))}
      </div>

      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((prev) => ({ ...prev, open }))}
        editingItem={itemDialog.editing}
        defaultCategoryId={itemDialog.defaultCategoryId}
      />
      <CategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) =>
          setCategoryDialog((prev) => ({ ...prev, open }))
        }
        editingCategory={categoryDialog.editing}
      />
    </div>
  )
}

export default CatalogView
