import { jsonStore, STORAGE_KEYS } from "./persistence"

export type SelectedSort = "default" | "category-name" | "name" | "last-added"

// Ordering of the selected-items panel. "default" preserves list insertion
// order; the other two modes are mutually exclusive sort strategies.
export const $selectedSort = jsonStore<SelectedSort>(
  STORAGE_KEYS.selectedSort,
  "default"
)

// Cycle order for the single sort button in the shopping panel. "default"
// preserves list insertion order; the rest are mutually exclusive sort
// strategies (category + name, name only, then last-added-first).
export const SELECTED_SORT_ORDER: SelectedSort[] = [
  "default",
  "category-name",
  "name",
  "last-added",
]

// Advances $selectedSort through SELECTED_SORT_ORDER (wrapping). The store owns
// the sort state machine, so the view only calls this on click rather than
// reading `$selectedSort.get()` to decide what to toggle next.
export function cycleSelectedSort(): void {
  const i = SELECTED_SORT_ORDER.indexOf($selectedSort.get())
  $selectedSort.set(SELECTED_SORT_ORDER[(i + 1) % SELECTED_SORT_ORDER.length])
}

// Open category accordion ids in the available-items (ItemsPanel) accordion.
// `null` means uninitialized — the panel then falls back to the first two
// categories open on the first visit. Once the user toggles anything, the
// exact open-id set is persisted so the layout is remembered across reloads.
// Keyed by categoryId so the remembered state survives catalog edits.
export const $accordionOpen = jsonStore<string[] | null>(
  STORAGE_KEYS.accordionOpen,
  null
)

export function setAccordionOpen(ids: string[]): void {
  $accordionOpen.set(ids)
}
