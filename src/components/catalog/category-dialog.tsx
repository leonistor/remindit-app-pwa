import {
  type ListCollection,
  useListCollection,
} from "@ark-ui/react/collection"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  addCategory,
  type Category,
  type CategoryFrequency,
  updateCategory,
} from "@/stores"
import { FREQUENCY_LABELS, FREQUENCY_OPTIONS } from "./frequency-labels"

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this category; otherwise it adds a new one. */
  editingCategory?: Category | null
}

export const CategoryDialog = ({
  open,
  onOpenChange,
  editingCategory,
}: CategoryDialogProps) => {
  const frequencyCollection = useListCollection<{
    label: string
    value: CategoryFrequency
  }>({
    initialItems: FREQUENCY_OPTIONS,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
  })

  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState<CategoryFrequency>("unknown")

  // Re-seed form state every time the dialog opens (for add or edit).
  useEffect(() => {
    if (!open) return
    setName(editingCategory?.name ?? "")
    setFrequency(editingCategory?.frequency ?? "unknown")
  }, [open, editingCategory])

  const trimmed = name.trim()
  const invalid = trimmed.length === 0

  const handleSave = () => {
    if (invalid) return
    if (editingCategory) {
      updateCategory(editingCategory.id, { name: trimmed, frequency })
    } else {
      addCategory(trimmed, frequency)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
      <DialogContent>
        <DialogHeader
          title={editingCategory ? "Edit category" : "Add category"}
          description={
            editingCategory
              ? "Rename the category or change how often it is bought."
              : "Name the category and set how often it is typically bought."
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
                placeholder="e.g. Dairy"
                autoFocus
              />
              {invalid && <FieldError>Name is required.</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Purchase frequency</FieldLabel>
              <Select
                collection={
                  frequencyCollection as unknown as ListCollection<unknown>
                }
                value={[frequency]}
                onValueChange={(details) =>
                  setFrequency(
                    (details.value[0] as CategoryFrequency) ?? "unknown"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} item={option}>
                      {FREQUENCY_LABELS[option.value]}
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
          <Button onClick={handleSave} disabled={invalid}>
            {editingCategory ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
