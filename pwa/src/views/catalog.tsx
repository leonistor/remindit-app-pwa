import { useStore } from "@nanostores/react"
import { FolderPlusIcon, InfoIcon, PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { BackButton } from "@/components/back-button"
import { CategoryDialog } from "@/components/catalog/category-dialog"
import { CategorySection } from "@/components/catalog/category-section"
import { ItemDialog } from "@/components/catalog/item-dialog"
import { Button } from "@/components/ui/custom/button"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { m } from "@/paraglide/messages"
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
          <h1 className="font-bold text-2xl">{m.catalogTitle()}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openAddItem()}>
            <PlusIcon />
            {m.catalogAddItem()}
          </Button>
          <Button variant="outline" onClick={openAddCategory}>
            <FolderPlusIcon />
            {m.catalogAddCategory()}
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
              <span className="font-medium text-foreground">
                {m.catalogLegendTap()}
              </span>{" "}
              {m.catalogLegendTapHint()}{" "}
              <span className="font-medium text-foreground">
                {m.catalogLegendSwipe()}
              </span>{" "}
              {m.catalogLegendSwipeHint()}{" "}
              <span className="font-medium text-foreground">{m.delete()}</span>{" "}
              {m.catalogLegendDeleteHint()}{" "}
              <span className="font-medium text-foreground">⋯</span>{" "}
              {m.catalogLegendMenuSuffix()}
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {m.catalogLegendDoubleClick()}
              </span>{" "}
              {m.catalogLegendDoubleClickHint()}{" "}
              <span className="font-medium text-foreground">⋯</span>{" "}
              {m.catalogLegendMoreActionsHint()}{" "}
              <span className="font-medium text-foreground">Uncategorized</span>
              {m.catalogLegendPressPrefix()}{" "}
              <span className="font-medium text-foreground">
                {m.catalogLegendEnter()}
              </span>{" "}
              {m.catalogLegendEnterHint()}
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
