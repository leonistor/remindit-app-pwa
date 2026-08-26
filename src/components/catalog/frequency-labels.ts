import type { CategoryFrequency } from "@/stores/types"

// Human-friendly labels for the purchase-frequency slugs, in
// CATEGORY_FREQUENCIES order. Used by the category dialog's picker and the
// category card's badge.
export const FREQUENCY_LABELS: Record<CategoryFrequency, string> = {
  daily: "Daily",
  "every-2-3-days": "Every 2–3 days",
  weekly: "Weekly",
  "every-2-weeks": "Every 2 weeks",
  monthly: "Monthly",
  "every-3-months": "Every 3 months",
  seldom: "Seldom",
  unknown: "Unknown",
}

export const FREQUENCY_OPTIONS = (
  Object.keys(FREQUENCY_LABELS) as CategoryFrequency[]
).map((value) => ({ label: FREQUENCY_LABELS[value], value }))
