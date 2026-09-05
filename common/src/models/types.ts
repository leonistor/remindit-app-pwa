// Shared domain types and constants for the shopping-list stores.
// Framework-agnostic: this module has no React/UI dependencies so the same
// store layer can back a React, Vue, or vanilla front-end.

// How often items in a category are typically purchased. Stored as a slug so it
// is key/URL-safe and stable across the app and fixtures.
export type CategoryFrequency =
  | "daily"
  | "every-2-3-days"
  | "weekly"
  | "every-2-weeks"
  | "monthly"
  | "every-3-months"
  | "seldom"
  | "unknown"

// Rank of a frequency on an ascending scale (most frequent first). Drives
// category ordering in the catalog and available-items views. Returns -1 for
// frequencies not in the list (e.g. legacy or unknown values).
export const frequencyRank = (f: CategoryFrequency): number =>
  CATEGORY_FREQUENCIES.indexOf(f)

// Ordered list of allowed frequencies (e.g. for building a picker or labels).
export const CATEGORY_FREQUENCIES: readonly CategoryFrequency[] = [
  "daily",
  "every-2-3-days",
  "weekly",
  "every-2-weeks",
  "monthly",
  "every-3-months",
  "seldom",
  "unknown",
] as const

export interface Category {
  id: string
  name: string
  /** How often items in this category are typically bought. */
  frequency: CategoryFrequency
  /**
   * Stable palette slot (index into the active palette's `colors`) used to color
   * this category. Assigned sequentially at dataset init / category creation so
   * categories stay distinct up to the palette size; undefined (or on the
   * `uncategorized` sentinel) means "no categorical color" (neutral).
   */
  color?: number
}

export interface CatalogItem {
  id: string
  name: string
  /** References Category.id. */
  categoryId: string
}

export interface ListEntry {
  /** Unique id for this specific list entry (not the item). */
  id: string
  /** References CatalogItem.id. */
  itemId: string
  checked: boolean
  /** Epoch millis when the entry was added. */
  addedAt: number
}

export type HistoryAction = "add" | "remove"

export interface HistoryEvent {
  id: string
  action: HistoryAction
  itemId: string
  itemName: string
  categoryId: string
  /** Snapshot of the category name at log time (categories may be renamed). */
  categoryName: string
  /** Epoch millis of the event. */
  timestamp: number
}

// Single-user profile (Phase 4 slice). username is the only mandatory field and
// defaults to a random value on first run (see profile-generator / onboarding).
// firstName, lastName, email, and avatar are optional — the app uses empty
// strings for unset text fields. avatar is a self-contained inline SVG data URI
// (DiceBear personas or a local initials fallback) so the profile stays fully
// local-first with no network request.
export interface UserProfile {
  username: string
  firstName?: string
  lastName?: string
  email?: string
  /** Inline SVG avatar as a data URI. */
  avatar?: string
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type RecommendationTier = "overdue" | "soon" | "frequent"

export interface Recommendation {
  item: CatalogItem
  categoryName: string
  score: number
  dueRatio: number
  tier: RecommendationTier
}

// Sentinel category. Always present in $categories; used as the destination
// when another category is deleted so catalog items are never orphaned.
export const UNCATEGORIZED_ID = "uncategorized"
export const UNCATEGORIZED_NAME = "Uncategorized"

// ---------------------------------------------------------------------------
// Notifications (D4 lifecycle events)
// ---------------------------------------------------------------------------

// Known in-app notification types. Single source of truth shared by the BFF
// dispatch callers and the pwa UI — a new lifecycle event touches this one
// const, not string literals scattered across modules.
export const NOTIFICATION_TYPES = {
  memberAdded: "member.added",
  memberLeft: "member.left",
  memberRemoved: "member.removed",
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
