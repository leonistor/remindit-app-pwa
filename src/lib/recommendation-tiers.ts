import type { RecommendationTier } from "@/stores/types"

// Single source of truth for the recommendation legend, so the catalog tooltip,
// the Help view, and the item-button dot color token can never drift apart.
//
// `dotColor` is the Tailwind background token for the legend pip; tiers with an
// empty token are intentionally omitted from the legend (they render no dot).
export const RECOMMENDATION_TIERS: Record<
  RecommendationTier,
  { label: string; description: string; dotColor: string }
> = {
  overdue: {
    label: "Overdue",
    description: "past its usual buy date",
    dotColor: "bg-destructive",
  },
  soon: {
    label: "Soon",
    description: "due for repurchase soon",
    dotColor: "bg-warning",
  },
  frequent: {
    label: "Frequent",
    description: "bought regularly",
    dotColor: "",
  },
}

// Tiers that render a colored dot — the ones shown in the legend.
export const LEGEND_TIERS = (
  Object.keys(RECOMMENDATION_TIERS) as RecommendationTier[]
).filter((tier) => RECOMMENDATION_TIERS[tier].dotColor !== "")
