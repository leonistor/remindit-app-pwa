import {
  type ListCollection,
  useListCollection,
} from "@ark-ui/react/collection"
import { useStore } from "@nanostores/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent>
        <DialogHeader
          title={editingItem ? "Edit item" : "Add item"}
          description={
            editingItem
              ? "Update the item's name or category."
              : "Give the item a name and pick its category."
          }
        />
        <DialogBody>
          <FieldGroup>
            <Field invalid={invalid}>
              <FieldLabel>Name</FieldLabel>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Milk"
                autoFocus
              />
              {invalid && <FieldError>Name is required.</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
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
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={invalid || !categoryId}>
            {editingItem ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
