import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/custom/button"
import { categoryPalette } from "@/lib/category-palette"
import { cn } from "@/lib/utils"
import { UNCATEGORIZED_NAME } from "@/stores/types"

export interface ShoppingItemProps {
  /** Display name of the item. */
  name: string
  /** Category label shown in a Badge above the name. */
  categoryName?: string
  /**
   * Stable category id. Used as the palette key so the chip shares the exact
   * color the catalog assigns to the same category (the catalog keys by id
   * too). Falls back to `categoryName` when absent.
   */
  categoryId?: string
  /** Whether to show the category Badge above the name. Defaults to true. */
  showCategory?: boolean
  /** Disabled state (e.g. during exit animation). */
  disabled?: boolean
  /** Click handler — typically removes the item from the list. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Optional className for layout overrides. */
  className?: string
  /**
   * When set, marks this chip as the target of an item-travel View Transition
   * (morphing to/from the catalog). Must match the itemId on both sides.
   */
  travelTargetId?: string
}

// A shopping-list chip that surfaces the item's category in a Badge above its
// name. Shares the categorical palette with ItemButton (catalog/available
// items) so both reflect the same category color; the chip itself reads as
// "in list" via the selected/emphasized tint.
export const ShoppingItem = ({
  name,
  categoryName,
  categoryId,
  showCategory = true,
  disabled,
  onClick,
  className,
  travelTargetId,
}: ShoppingItemProps) => {
  const label = categoryName?.trim() || UNCATEGORIZED_NAME
  // Key by the stable category id (matching the catalog) so the same category
  // keeps one color across panels; fall back to the name when no id is given.
  const palette = categoryPalette((categoryId ?? categoryName ?? UNCATEGORIZED_NAME).trim())

  return (
    <div
      className={cn("flex flex-col items-start gap-1", className)}
      style={palette.style}
    >
      {showCategory && (
        <Badge
          pill
          className={cn("pointer-events-none", palette.badge)}
        >
          {label}
        </Badge>
      )}
      <Button
        variant="bare"
        pill
        disabled={disabled}
        onClick={onClick}
        className={palette.buttonSelected}
        data-vt-list={travelTargetId}
      >
        {name}
      </Button>
    </div>
  )
}
