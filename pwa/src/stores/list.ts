// Active shopping list. Adding/removing entries is the ONLY thing that writes
// history (via logHistory in ./history).
//
// DOCUMENTED EXCEPTION to the cross-store rule: the `logHistory` import below
// is the one sanctioned action-level edge — history logging is intrinsic to
// list mutation, so it stays in this module rather than being pushed into
// `./commands.ts`. No other sibling-store action imports are permitted here.
//
// Single outgoing edge, no cycle: `getCatalogItem` is read from `./catalog` so
// the add/remove flows can snapshot the item name/categoryId into history. The
// catalog store never imports back into this module — cross-store compositing
// (e.g. `createItemAndAddToList`) lives in `./commands.ts`.

import { getCatalogItem } from "./catalog"
import { logHistory } from "./history"
import { jsonStore, STORAGE_KEYS } from "./persistence"
import type { ListEntry } from "./types"
import { UNCATEGORIZED_ID } from "./types"

const $list = jsonStore<ListEntry[]>(STORAGE_KEYS.list, [])

// Removes every list entry that references the given catalog item.
// Exposed so catalog deletion can cascade without writing history.
export function removeListEntriesForItem(itemId: string): void {
  const list = $list.get()
  const next = list.filter((entry) => entry.itemId !== itemId)
  if (next.length !== list.length) $list.set(next)
}

export function addToList(itemId: string): void {
  const item = getCatalogItem(itemId)
  if (!item) return
  const list = $list.get()
  if (list.some((entry) => entry.itemId === itemId)) return
  const entry: ListEntry = {
    id: crypto.randomUUID(),
    itemId: item.id,
    checked: false,
    addedAt: Date.now(),
  }
  $list.set([...list, entry])
  logHistory({
    action: "add",
    itemId: item.id,
    itemName: item.name,
    categoryId: item.categoryId,
  })
}

export function removeFromList(entryId: string): void {
  const list = $list.get()
  const entry = list.find((e) => e.id === entryId)
  if (!entry) return
  $list.set(list.filter((e) => e.id !== entryId))
  const item = getCatalogItem(entry.itemId)
  logHistory({
    action: "remove",
    itemId: entry.itemId,
    itemName: item?.name ?? "(unknown)",
    categoryId: item?.categoryId ?? UNCATEGORIZED_ID,
  })
}

// Removes all list entries that reference the given catalog item, logging a
// single "remove" history event. Multi-device merge can produce duplicates.
export function removeFromListByItemId(itemId: string): void {
  const list = $list.get()
  const matches = list.filter((e) => e.itemId === itemId)
  if (matches.length === 0) return
  // Remove all matching entries at once.
  $list.set(list.filter((e) => e.itemId !== itemId))
  // Log one history event for the removal (first match is enough for the
  // snapshot — item name/categoryId are identical across duplicates).
  const item = getCatalogItem(itemId)
  logHistory({
    action: "remove",
    itemId,
    itemName: item?.name ?? "(unknown)",
    categoryId: item?.categoryId ?? UNCATEGORIZED_ID,
  })
}

export function setEntryChecked(entryId: string, checked: boolean): void {
  const list = $list.get()
  const index = list.findIndex((e) => e.id === entryId)
  if (index === -1) return
  const next = list.slice()
  next[index] = { ...next[index], checked }
  $list.set(next)
}

export function clearList(): void {
  $list.set([])
}

export { $list }
