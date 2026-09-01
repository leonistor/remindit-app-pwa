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
import { m } from "@/paraglide/messages"
import {
  addCategory,
  type Category,
  type CategoryFrequency,
  updateCategory,
} from "@/stores"
import { FREQUENCY_OPTIONS, frequencyLabel } from "./frequency-labels"

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
    value: CategoryFrequency
  }>({
    initialItems: FREQUENCY_OPTIONS,
    itemToValue: (item) => item.value,
    // Resolved at call time so the label follows the active language.
    itemToString: (item) => frequencyLabel(item.value),
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
      title={editingCategory ? m.catalogEditCategory() : m.catalogAddCategory()}
      description={
        editingCategory
          ? m.categoryDialogEditDescription()
          : m.categoryDialogAddDescription()
      }
      onSave={handleSave}
      saveLabel={editingCategory ? m.save() : m.add()}
      saveDisabled={invalid}
    >
      <FieldGroup>
        <ValidatedField
          label={m.categoryDialogNameLabel()}
          invalid={invalid}
          error={m.categoryDialogNameRequired()}
        >
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m.categoryDialogNamePlaceholder()}
            autoFocus
          />
        </ValidatedField>
        <ValidatedField label={m.categoryDialogFrequencyLabel()}>
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
              <SelectValue
                placeholder={m.categoryDialogFrequencyPlaceholder()}
              />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} item={option}>
                  {frequencyLabel(option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ValidatedField>
      </FieldGroup>
    </FormDialog>
  )
}
