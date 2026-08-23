// Active shopping list. Adding/removing entries is the ONLY thing that writes
// history (via logHistory in ./history).

import { persistentJSON } from "@nanostores/persistent"
import { addCatalogItem, getCatalogItem } from "./catalog"
import { logHistory } from "./history"
import type { ListEntry } from "./types"
import { UNCATEGORIZED_ID } from "./types"

const $list = persistentJSON<ListEntry[]>("remindit:list", [])

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

// Convenience: create a brand-new catalog item and immediately add it to the
// active list (e.g. quick-add from the UI).
export function createItemAndAddToList(name: string, categoryId: string): void {
  const item = addCatalogItem(name, categoryId)
  addToList(item.id)
}

export { $list }
