import { m } from "@/paraglide/messages"
import type { CategoryFrequency } from "@/stores/types"

// Human-friendly labels for the purchase-frequency slugs, in
// CATEGORY_FREQUENCIES order. Used by the category dialog's picker and the
// category card's frequency button. Slugs are data (persisted in the store,
// never translated); label strings resolve through m.* at call time so they
// follow the active language instead of freezing at module import.
const FREQUENCY_MESSAGE_FNS: Record<CategoryFrequency, () => string> = {
  daily: m.freqDaily,
  "every-2-3-days": m.freqEvery2To3Days,
  weekly: m.freqWeekly,
  "every-2-weeks": m.freqEvery2Weeks,
  monthly: m.freqMonthly,
  "every-3-months": m.freqEvery3Months,
  seldom: m.freqSeldom,
  unknown: m.freqUnknown,
}

/** Label for a frequency slug, resolved in the active language. */
export const frequencyLabel = (frequency: CategoryFrequency): string =>
  FREQUENCY_MESSAGE_FNS[frequency]()

export const FREQUENCY_OPTIONS = (
  Object.keys(FREQUENCY_MESSAGE_FNS) as CategoryFrequency[]
).map((value) => ({ value }))
