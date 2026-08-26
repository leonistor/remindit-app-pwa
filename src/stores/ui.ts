import { persistentJSON } from "@nanostores/persistent"

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
