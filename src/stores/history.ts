// History of shopping events. Logs ONLY add/remove-from-list actions.
// Editing, deleting, or renaming catalog items / categories must never write
// here — those callers simply do not invoke logHistory().

import { persistentJSON } from "@nanostores/persistent"
import type { HistoryAction, HistoryEvent } from "./types"

const $history = persistentJSON<HistoryEvent[]>("remindit:history", [])

export interface LogHistoryInput {
  action: HistoryAction
  itemId: string
  itemName: string
  categoryId: string
}

/** Append a shopping event. Returns the created event. */
export function logHistory(input: LogHistoryInput): HistoryEvent {
  const event: HistoryEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...input,
  }
  $history.set([...$history.get(), event])
  return event
}

export function clearHistory(): void {
  $history.set([])
}

export { $history }
