import type { ButtonProps } from "./button"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import type { RecommendationTier } from "@/stores/types"

type ItemPurpose = "selectable" | "removable" | "recommendation"

const tierDotColor: Record<RecommendationTier, string> = {
  overdue: "bg-destructive",
  soon: "bg-warning",
  frequent: "",
}

export interface ItemButtonProps {
  /** Display name of the item. */
  name: string
  /** Semantic purpose — maps to a Button variant internally. */
  purpose: ItemPurpose
  /** Whether this item is currently selected/active (only applies to "selectable" purpose). */
  isSelected?: boolean
  /** Recommendation tier — shows a colored dot when set. */
  recommendationTier?: RecommendationTier
  /** Disabled state (e.g. during exit animation). */
  disabled?: boolean
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Optional className for layout overrides. */
  className?: string
}

function purposeToVariant(
  purpose: ItemPurpose,
  isSelected: boolean
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
  recommendationTier,
  disabled,
  onClick,
  className,
}: ItemButtonProps) => {
  const dotColor = recommendationTier ? tierDotColor[recommendationTier] : ""

  return (
    <Button
      variant={purposeToVariant(purpose, isSelected)}
      pill
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {name}
      {dotColor && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 inline-block size-2 rounded-full ring-2 ring-background",
            dotColor
          )}
          aria-hidden
        />
      )}
    </Button>
  )
}
