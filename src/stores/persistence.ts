// Centralized persistence configuration for every store.
//
// Defining the storage keys and the shared serialization helper in one place
// keeps each store's wiring uniform (every data store uses JSON) and makes a
// future swap to a remote-backed adapter a single-file change. Stores import
// `jsonStore` + `STORAGE_KEYS` from here rather than calling
// `@nanostores/persistent` directly or hardcoding key literals.

import { persistentJSON } from "@nanostores/persistent"

// Shared key prefix; kept here so a key rename touches exactly one file.
export const STORAGE_KEYS = {
  list: "remindit:list",
  history: "remindit:history",
  catalog: "remindit:catalog",
  categories: "remindit:categories",
  user: "remindit:user",
  selectedCategoriesVisible: "remindit:selected-categories-visible",
  selectedSort: "remindit:selected-sort",
  accordionOpen: "remindit:accordion-open",
  theme: "remindit:theme",
  activePalette: "remindit:active-palette",
} as const

// JSON-encoded persistent store. The single serialization strategy avoids the
// raw-string-vs-JSON drift the theme store used to have. Stores that need custom
// (and migration-friendly) encode/decode — e.g. theme, which tolerates legacy
// raw values — use `persistentAtom` directly with these keys.
export function jsonStore<T>(key: string, initial: T) {
  return persistentJSON<T>(key, initial)
}
