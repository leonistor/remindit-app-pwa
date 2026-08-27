import { cn } from "@/lib/utils"
import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"
import {
  categoryPalette,
  type ItemPaletteSlot,
} from "@/lib/category-palette"
import type { RecommendationTier } from "@/stores/types"
import { Button } from "./button"

type ItemPurpose = "selectable" | "removable" | "recommendation"

export type ItemAnimationState = "enter" | "exit" | "idle"

export interface ItemButtonProps {
  /** Display name of the item. */
  name: string
  /** Semantic purpose — drives emphasis, not color. */
  purpose: ItemPurpose
  /**
   * Stable key (category id or name) used to derive the categorical tint.
   * Color is qualitative and independent of `purpose`.
   */
  categoryKey?: string
  /** Optional explicit palette slot (e.g. a future user-assigned color). */
  paletteOverride?: ItemPaletteSlot
  /** Whether this item is currently selected/active (only for "selectable"). */
  isSelected?: boolean
  /** Recommendation tier — shows a colored dot (semantic, not palette). */
  recommendationTier?: RecommendationTier
  /** Disabled state (e.g. during exit animation). */
  disabled?: boolean
  /** Enter/exit animation hook for add/remove transitions. */
  animationState?: ItemAnimationState
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Optional className for layout overrides. */
  className?: string
}

export const ItemButton = ({
  name,
  purpose,
  categoryKey,
  paletteOverride,
  isSelected = false,
  recommendationTier,
  disabled,
  animationState = "idle",
  onClick,
  className,
}: ItemButtonProps) => {
  // Removable/recommendation chips are inherently emphasized (in-list or
  // surfaced); only "selectable" toggles emphasis via `isSelected`.
  const selected =
    purpose === "removable" || purpose === "recommendation"
      ? true
      : isSelected

  const palette = categoryPalette(categoryKey ?? name, paletteOverride)
  const colorClasses = selected ? palette.buttonSelected : palette.button

  const animationClass =
    animationState === "enter"
      ? "animate-item-enter motion-reduce:animate-none"
      : animationState === "exit"
        ? "animate-item-exit motion-reduce:animate-none"
        : ""

  const dotColor = recommendationTier
    ? RECOMMENDATION_TIERS[recommendationTier].dotColor
    : ""

  return (
    <Button
      variant="bare"
      pill
      disabled={disabled}
      onClick={onClick}
      className={cn(colorClasses, animationClass, className)}
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
