import { CaretDownIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/custom/button"
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu"
import { m } from "@/paraglide/messages"
import { type CategoryFrequency, updateCategory } from "@/stores"
import { FREQUENCY_OPTIONS, frequencyLabel } from "./frequency-labels"

interface CategoryFrequencyMenuProps {
  categoryId: string
  categoryName: string
  frequency: CategoryFrequency
}

// Inline purchase-frequency picker: a Shark Menu whose content is a single
// radio-group Listbox of the allowed frequencies (the shark-native "Listbox
// within a Menu"). Selecting an option writes straight to the store.
export const CategoryFrequencyMenu = ({
  categoryId,
  categoryName,
  frequency,
}: CategoryFrequencyMenuProps) => (
  <Menu positioning={{ placement: "bottom-end" }}>
    <MenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        aria-label={m.catalogChangeFrequencyAria({ name: categoryName })}
      >
        {frequencyLabel(frequency)}
        <CaretDownIcon />
      </Button>
    </MenuTrigger>
    <MenuContent>
      <MenuRadioGroup
        value={frequency}
        onValueChange={(details) =>
          updateCategory(categoryId, {
            frequency: details.value as CategoryFrequency,
          })
        }
      >
        {FREQUENCY_OPTIONS.map((option) => (
          <MenuRadioItem key={option.value} value={option.value}>
            {frequencyLabel(option.value)}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </MenuContent>
  </Menu>
)
