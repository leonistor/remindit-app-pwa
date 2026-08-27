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
  /**
   * When set, marks this chip as the target of an item-travel View Transition
   * (morphing to/from the shopping list). Must match the itemId on both sides.
   */
  travelTargetId?: string
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
  travelTargetId,
}: ItemButtonProps) => {
  // Removable/recommendation chips are inherently emphasized (in-list or
  // surfaced) via the stronger `buttonSelected` tint. "Selectable" chips stay
  // at the resting `button` border; a selected one is merely dimmed (so it
  // reads as "already added" without a heavier border or being disabled).
  const emphasized =
    purpose === "removable" || purpose === "recommendation"
  const dimmed = purpose === "selectable" && isSelected

  const palette = categoryPalette(categoryKey ?? name, paletteOverride)
  const colorClasses = emphasized
    ? palette.buttonSelected
    : dimmed
      ? palette.dimmed
      : palette.button

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
      style={palette.style}
      data-testid="catalog-item"
      data-selected={isSelected ? "true" : "false"}
      data-vt-catalog={travelTargetId}
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
