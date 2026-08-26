import { persistentAtom, persistentJSON } from "@nanostores/persistent"

export type SelectedSort = "default" | "category-name" | "last-added"

// Whether the category Badge is shown on each selected-item chip.
export const $selectedCategoriesVisible = persistentAtom<boolean>(
  "remindit:selected-categories-visible",
  true,
  { encode: JSON.stringify, decode: JSON.parse }
)

// Ordering of the selected-items panel. "default" preserves list insertion
// order; the other two modes are mutually exclusive sort strategies.
export const $selectedSort = persistentAtom<SelectedSort>(
  "remindit:selected-sort",
  "default",
  { encode: JSON.stringify, decode: JSON.parse }
)

export function setSelectedCategoriesVisible(visible: boolean): void {
  $selectedCategoriesVisible.set(visible)
}

export function setSelectedSort(sort: SelectedSort): void {
  $selectedSort.set(sort)
}

// Open category accordion ids in the available-items (ItemsPanel) accordion.
// `null` means uninitialized — the panel then falls back to "all open" on the
// first visit, preserving the original default. Once the user toggles anything,
// the exact open-id set is persisted so the layout is remembered across reloads.
// Keyed by categoryId so the remembered state survives catalog edits.
export const $accordionOpen = persistentJSON<string[] | null>(
  "remindit:accordion-open",
  null
)

export function setAccordionOpen(ids: string[]): void {
  $accordionOpen.set(ids)
}
