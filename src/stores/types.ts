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
  /** Epoch millis of the event. */
  timestamp: number
}

export interface User {
  name: string
  /** Avatar URL or image reference. */
  photo: string
}

// Sentinel category. Always present in $categories; used as the destination
// when another category is deleted so catalog items are never orphaned.
export const UNCATEGORIZED_ID = "uncategorized"
export const UNCATEGORIZED_NAME = "Uncategorized"
