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

// Tiers that count as "actively recommended" for UI summaries (the catalog's
// per-category count badge): exactly the tiers that render a dot, so a count
// always agrees with what the user can see. `frequent` renders no dot and is
// where a bought-then-restored recommendation lands — counting it would
// re-inflate the badge after the user has acted on the recommendation.
export const isRecommended = (tier: RecommendationTier): boolean =>
  RECOMMENDATION_TIERS[tier].dotColor !== ""
