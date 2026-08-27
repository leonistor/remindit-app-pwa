import { jsonStore, STORAGE_KEYS } from "./persistence"

export type SelectedSort = "default" | "category-name" | "last-added"

// Whether the category Badge is shown on each selected-item chip.
export const $selectedCategoriesVisible = jsonStore<boolean>(
  STORAGE_KEYS.selectedCategoriesVisible,
  true
)

// Ordering of the selected-items panel. "default" preserves list insertion
// order; the other two modes are mutually exclusive sort strategies.
export const $selectedSort = jsonStore<SelectedSort>(
  STORAGE_KEYS.selectedSort,
  "default"
)

export function setSelectedCategoriesVisible(visible: boolean): void {
  $selectedCategoriesVisible.set(visible)
}

// Toggles the category-badge visibility on the selected-items chips. Components
// call this on the toggle's change instead of diffing the current value, so the
// UI store owns the boolean flip rather than the view.
export function toggleCategoriesVisible(): void {
  $selectedCategoriesVisible.set(!$selectedCategoriesVisible.get())
}

export function setSelectedSort(sort: SelectedSort): void {
  $selectedSort.set(sort)
}

// Mutually-exclusive sort toggle. Clicking the active sort clears it back to
// "default"; clicking the other sort switches to it. The state machine lives
// here (not in the view) so components never read `$selectedSort.get()` to
// decide what to toggle next, and the two sort modes can never both be on.
export function toggleSelectedSort(sort: SelectedSort): void {
  $selectedSort.set($selectedSort.get() === sort ? "default" : sort)
}

// Open category accordion ids in the available-items (ItemsPanel) accordion.
// `null` means uninitialized — the panel then falls back to "all open" on the
// first visit, preserving the original default. Once the user toggles anything,
// the exact open-id set is persisted so the layout is remembered across reloads.
// Keyed by categoryId so the remembered state survives catalog edits.
export const $accordionOpen = jsonStore<string[] | null>(
  STORAGE_KEYS.accordionOpen,
  null
)

export function setAccordionOpen(ids: string[]): void {
  $accordionOpen.set(ids)
}
