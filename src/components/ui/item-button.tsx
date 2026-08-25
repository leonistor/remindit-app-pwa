import type { ButtonProps } from "@/components/ui/button"
import { Button } from "@/components/ui/button"

type ItemPurpose = "selectable" | "removable" | "recommendation"

export interface ItemButtonProps {
  /** Display name of the item. */
  name: string
  /** Semantic purpose — maps to a Button variant internally. */
  purpose: ItemPurpose
  /** Whether this item is currently selected/active (only applies to "selectable" purpose). */
  isSelected?: boolean
  /** Disabled state (e.g. during exit animation). */
  disabled?: boolean
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Optional className for layout overrides. */
  className?: string
}

function purposeToVariant(
  purpose: ItemPurpose,
  isSelected: boolean,
): NonNullable<ButtonProps["variant"]> {
  switch (purpose) {
    case "selectable":
      return isSelected ? "outline" : "info"
    case "removable":
      return "success"
    case "recommendation":
      return "default"
  }
}

export const ItemButton = ({
  name,
  purpose,
  isSelected = false,
  disabled,
  onClick,
  className,
}: ItemButtonProps) => {
  return (
    <Button
      variant={purposeToVariant(purpose, isSelected)}
      pill
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {name}
    </Button>
  )
}
