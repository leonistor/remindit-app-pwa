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
  const { collection: frequencyCollection } = useListCollection<{
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingCategory ? "Edit category" : "Add category"}
      description={
        editingCategory
          ? "Rename the category or change how often it is bought."
          : "Name the category and set how often it is typically bought."
      }
      onSave={handleSave}
      saveLabel={editingCategory ? "Save" : "Add"}
      saveDisabled={invalid}
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
            placeholder="e.g. Dairy"
            autoFocus
          />
        </ValidatedField>
        <ValidatedField label="Purchase frequency">
          <Select
            collection={
              frequencyCollection as unknown as ListCollection<unknown>
            }
            value={[frequency]}
            onValueChange={(details) =>
              setFrequency((details.value[0] as CategoryFrequency) ?? "unknown")
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
        </ValidatedField>
      </FieldGroup>
    </FormDialog>
  )
}
