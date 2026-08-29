// History of shopping events. Logs ONLY add/remove-from-list actions.
// Editing, deleting, or renaming catalog items / categories must never write
// here — those callers simply do not invoke logHistory().

import { jsonStore, STORAGE_KEYS } from "./persistence"
import { $categories } from "./categories"
import { UNCATEGORIZED_NAME, type HistoryAction, type HistoryEvent } from "./types"

const $history = jsonStore<HistoryEvent[]>(STORAGE_KEYS.history, [])

export interface LogHistoryInput {
  action: HistoryAction
  itemId: string
  itemName: string
  categoryId: string
}

/** Append a shopping event. Returns the created event. */
export function logHistory(input: LogHistoryInput): HistoryEvent {
  const categoryName =
    $categories
      .get()
      .find((c) => c.id === input.categoryId)?.name ?? UNCATEGORIZED_NAME
  const event: HistoryEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...input,
    categoryName,
  }
  $history.set([...$history.get(), event])
  return event
}

export function clearHistory(): void {
  $history.set([])
}

export { $history }
