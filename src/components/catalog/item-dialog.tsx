import { useStore } from "@nanostores/react"
import { useEffect, useState } from "react"
import {
  type ListCollection,
  useListCollection,
} from "@/components/ui/custom/collection"
import { FormDialog } from "@/components/ui/custom/form-dialog"
import { ValidatedField } from "@/components/ui/custom/validated-field"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  $categories,
  addCatalogItem,
  type CatalogByCategoryItem,
  type Category,
  updateCatalogItem,
} from "@/stores"

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this item; otherwise it adds a new one. */
  editingItem?: CatalogByCategoryItem | null
  /** Category pre-selected for a new item (e.g. the card it was added from). */
  defaultCategoryId?: string
}

export const ItemDialog = ({
  open,
  onOpenChange,
  editingItem,
  defaultCategoryId,
}: ItemDialogProps) => {
  const categories = useStore($categories)
  const { collection: categoryCollection } = useListCollection<Category>({
    initialItems: categories,
    itemToValue: (item) => item.id,
    itemToString: (item) => item.name,
  })

  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "")

  // Re-seed form state every time the dialog opens (for add or edit).
  useEffect(() => {
    if (!open) return
    setName(editingItem?.name ?? "")
    setCategoryId(
      editingItem?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ""
    )
  }, [open, editingItem, defaultCategoryId, categories])

  const trimmed = name.trim()
  const invalid = trimmed.length === 0

  const handleSave = () => {
    if (invalid || !categoryId) return
    if (editingItem) {
      updateCatalogItem(editingItem.id, { name: trimmed, categoryId })
    } else {
      addCatalogItem(trimmed, categoryId)
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingItem ? "Edit item" : "Add item"}
      description={
        editingItem
          ? "Update the item's name or category."
          : "Give the item a name and pick its category."
      }
      onSave={handleSave}
      saveLabel={editingItem ? "Save" : "Add"}
      saveDisabled={invalid || !categoryId}
    >
      <FieldGroup>
        <ValidatedField
          label="Name"
          invalid={invalid}
          error="Name is required."
        >
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Milk"
            autoFocus
          />
        </ValidatedField>
        <ValidatedField label="Category">
          <Select
            collection={
              categoryCollection as unknown as ListCollection<unknown>
            }
            value={categoryId ? [categoryId] : []}
            onValueChange={(details) =>
              setCategoryId((details.value[0] as string) ?? "")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} item={category}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ValidatedField>
      </FieldGroup>
    </FormDialog>
  )
}
