import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/custom/button"
import { cn } from "@/lib/utils"
import { UNCATEGORIZED_NAME } from "@/stores/types"

export interface ShoppingItemProps {
  /** Display name of the item. */
  name: string
  /** Category label shown in a Badge above the name. */
  categoryName?: string
  /** Whether to show the category Badge above the name. Defaults to true. */
  showCategory?: boolean
  /** Disabled state (e.g. during exit animation). */
  disabled?: boolean
  /** Click handler — typically removes the item from the list. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Optional className for layout overrides. */
  className?: string
}

// A shopping-list chip that surfaces the item's category in a Badge above its
// name. Distinct from ItemButton (catalog/available items) which only shows the
// name. Mirrors ItemButton's success/removable styling for the selected list.
export const ShoppingItem = ({
  name,
  categoryName,
  showCategory = true,
  disabled,
  onClick,
  className,
}: ShoppingItemProps) => {
  const label = categoryName?.trim() || UNCATEGORIZED_NAME

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      {showCategory && (
        <Badge variant="success" pill className="pointer-events-none">
          {label}
        </Badge>
      )}
      <Button variant="success" pill disabled={disabled} onClick={onClick}>
        {name}
      </Button>
    </div>
  )
}
