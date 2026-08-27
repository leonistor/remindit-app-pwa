import { FolderPlusIcon, PlusIcon } from "@phosphor-icons/react"
import { useStore } from "@nanostores/react"
import { useState } from "react"
import { CategorySection } from "@/components/catalog/category-section"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { ItemDialog } from "@/components/catalog/item-dialog"
import { Button } from "@/components/ui/custom/button"
import { $catalogByCategoryAll } from "@/stores"

const CatalogView = () => {
  const groups = useStore($catalogByCategoryAll)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemDialogCategoryId, setItemDialogCategoryId] = useState<
    string | undefined
  >(undefined)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)

  const openAddItem = (categoryId?: string) => {
    setItemDialogCategoryId(categoryId)
    setItemDialogOpen(true)
  }
  const openAddCategory = () => setCategoryDialogOpen(true)

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
          <CategorySection
            key={group.categoryId}
            group={group}
            onAddItem={openAddItem}
          />
        ))}
      </div>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        defaultCategoryId={itemDialogCategoryId}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
    </div>
  )
}

export default CatalogView
