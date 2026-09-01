// Unit tests for the commands layer (src/stores/commands).
//
// Commands compose the single-resource store modules into cross-store flows, so
// we assert against the individual atoms and the history store. We import
// submodules directly (NOT the `@/stores` barrel) because the barrel runs
// `initStores` + a dev logger as a side effect.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { collectLocalData, type LocalDataEnvelope } from "@/lib/local-data"
import { PALETTE_POOL } from "@/lib/palettes"
import { $catalog, addCatalogItem } from "@/stores/catalog"
import {
  $categories,
  addCategory,
  ensureUncategorizedExists,
} from "@/stores/categories"
import {
  createItemAndAddToList,
  deleteCatalogItemWithCascade,
  deleteCategoryWithReassign,
  restoreLocalData,
  wipeAllData,
} from "@/stores/commands"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { $onboarded, $selectedDatasetId } from "@/stores/onboarding"
import { $activePaletteId, setActivePalette } from "@/stores/palette"
import { STORAGE_KEYS } from "@/stores/persistence"
import { $installDismissed } from "@/stores/pwa-install"
import { $theme } from "@/stores/theme"
import type { HistoryEvent } from "@/stores/types"
import { CATEGORY_FREQUENCIES, UNCATEGORIZED_ID } from "@/stores/types"
import { $accordionOpen, $selectedSort } from "@/stores/ui"
import { $user } from "@/stores/user"
import { resetStores } from "../fixtures/reset"

describe("stores commands", () => {
  beforeEach(resetStores)

  test("deleteCategoryWithReassign reassigns catalog items to UNCATEGORIZED and drops the category (no history)", () => {
    const category = addCategory("Produce")
    const item = addCatalogItem("Apple", category.id)

    const historyBefore = $history.get().length

    deleteCategoryWithReassign(category.id)

    // The catalog item now points at the sentinel category.
    const updatedItem = $catalog.get().find((i) => i.id === item.id)
    expect(updatedItem?.categoryId).toBe(UNCATEGORIZED_ID)

    // The category itself is gone from the list.
    expect($categories.get().some((c) => c.id === category.id)).toBe(false)

    // Deleting a category must NOT write history.
    expect($history.get()).toHaveLength(historyBefore)
  })

  test("deleteCategoryWithReassign is a no-op for UNCATEGORIZED_ID", () => {
    $categories.set([
      { id: UNCATEGORIZED_ID, name: "Uncategorized", frequency: "unknown" },
      { id: "cat-produce", name: "Produce", frequency: "unknown" },
    ])

    deleteCategoryWithReassign(UNCATEGORIZED_ID)

    const categories = $categories.get()
    expect(categories.some((c) => c.id === UNCATEGORIZED_ID)).toBe(true)
    expect(categories.some((c) => c.id === "cat-produce")).toBe(true)
  })

  test("deleteCatalogItemWithCascade removes the item and drops referencing $list entries without writing history", () => {
    const item = addCatalogItem("Bread", "cat-bakery")

    $list.set([
      { id: "entry-1", itemId: item.id, checked: false, addedAt: Date.now() },
      {
        id: "entry-2",
        itemId: "other-item",
        checked: false,
        addedAt: Date.now(),
      },
    ])

    const seededHistory: HistoryEvent = {
      id: "hist-1",
      action: "add",
      itemId: "item-x",
      itemName: "Cheese",
      categoryId: "cat-dairy",
      timestamp: Date.now(),
    }
    $history.set([seededHistory])

    deleteCatalogItemWithCascade(item.id)

    expect($catalog.get()).toHaveLength(0)
    expect($catalog.get().find((i) => i.id === item.id)).toBeUndefined()

    const list = $list.get()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe("entry-2")

    // History is untouched — removal must NOT log anything.
    expect($history.get()).toHaveLength(1)
    expect($history.get()[0]).toBe(seededHistory)
  })

  test("createItemAndAddToList creates a catalog item, adds an entry, and logs one 'add'", () => {
    createItemAndAddToList("Banana", "cat-produce")

    expect($catalog.get()).toHaveLength(1)
    expect($catalog.get()[0].name).toBe("Banana")
    expect($catalog.get()[0].categoryId).toBe("cat-produce")

    expect($list.get()).toHaveLength(1)
    expect($list.get()[0].itemId).toBe($catalog.get()[0].id)

    const events = $history.get()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe("add")
    expect(events[0].itemName).toBe("Banana")
    expect(events[0].categoryId).toBe("cat-produce")
  })
})

describe("restoreLocalData", () => {
  beforeEach(resetStores)

  test("round-trips a snapshot: wipe then restore leaves every store equal to the envelope", () => {
    // Build a real app-like state through the store actions (list add logs
    // history; the sentinel always exists in a live app).
    const category = addCategory("Produce", "weekly")
    createItemAndAddToList("Apple", category.id)
    ensureUncategorizedExists()
    $user.set({
      username: "leo",
      firstName: "Leo",
      lastName: "Nistor",
      email: "leo@example.com",
      avatar: "",
    })
    $theme.set("dark")
    setActivePalette(PALETTE_POOL.palettes[1].id)
    $selectedSort.set("name")
    $accordionOpen.set([category.id])
    $onboarded.set(true)
    $selectedDatasetId.set("minimal")
    $installDismissed.set(true)

    const envelope = collectLocalData()

    wipeAllData()
    expect($catalog.get()).toHaveLength(0)

    restoreLocalData(envelope)

    expect($catalog.get()).toEqual(envelope.data.catalog)
    expect($categories.get()).toEqual(envelope.data.categories)
    expect($list.get()).toEqual(envelope.data.list)
    expect($history.get()).toEqual(envelope.data.history)
    expect($user.get()).toEqual(envelope.data.user)
    expect($theme.get()).toBe(envelope.data.theme)
    expect($activePaletteId.get()).toBe(envelope.data.activePalette)
    expect($selectedSort.get()).toBe(envelope.data.selectedSort)
    expect($accordionOpen.get()).toEqual(envelope.data.accordionOpen)
    // Forced true regardless of what the snapshot carried.
    expect($onboarded.get()).toBe(true)
    expect($selectedDatasetId.get()).toBe(envelope.data.selectedDataset)
    expect($installDismissed.get()).toBe(envelope.data.installDismissed)
  })

  test("normalizes an older minimal backup (no sentinel, colors, or frequencies)", () => {
    $onboarded.set(false)

    // Hand-written "older" backup: categories predate the color-slot and
    // frequency fields, the sentinel is absent, and the snapshot says
    // onboarded:false — restore must still land well-formed and never
    // re-open the onboarding gate. The cast models the loose shape a real
    // old file parses into.
    const envelope = {
      version: "4.0.0",
      exportedAt: "2026-01-01T00:00:00.000Z",
      data: {
        catalog: [{ id: "item-1", name: "Apple", categoryId: "cat-produce" }],
        categories: [
          { id: "cat-produce", name: "Produce" },
          { id: "cat-bakery", name: "Bakery" },
        ],
        list: [],
        history: [],
        user: { username: "leo" },
        theme: "dark",
        activePalette: "paired",
        selectedSort: "name",
        accordionOpen: null,
        onboarded: false,
        selectedDataset: "minimal",
        installDismissed: false,
      },
    } as unknown as LocalDataEnvelope

    restoreLocalData(envelope)

    const categories = $categories.get()
    expect(categories.some((c) => c.id === UNCATEGORIZED_ID)).toBe(true)
    for (const category of categories) {
      // The sentinel deliberately carries no color slot (neutral).
      if (category.id === UNCATEGORIZED_ID) continue
      expect(typeof category.color).toBe("number")
      expect(CATEGORY_FREQUENCIES).toContain(category.frequency)
    }
    expect($onboarded.get()).toBe(true)
  })

  test("persists the restored snapshot to localStorage and leaves unrelated keys alone", () => {
    // Build a real app-like state so the persisted keys carry recognizable
    // values, then wipe (which clears localStorage) before restoring.
    const category = addCategory("Produce", "weekly")
    addCatalogItem("Apple", category.id)
    ensureUncategorizedExists()
    $user.set({
      username: "leo",
      firstName: "Leo",
      lastName: "Nistor",
      email: "leo@example.com",
      avatar: "",
    })

    const envelope = collectLocalData()
    wipeAllData()

    // The locale key is owned by Paraglide, not by any of the 12 persisted
    // atoms — restore's no-localStorage.clear() design must keep it (and any
    // third-party key) intact while every `remindit:` atom key is overwritten.
    localStorage.setItem("remindit:locale", "ro")
    localStorage.setItem("unrelated-key", "keep-me")

    restoreLocalData(envelope)

    expect(localStorage.getItem(STORAGE_KEYS.onboarded)).toBe("true")
    expect(localStorage.getItem(STORAGE_KEYS.catalog)).toBe(
      JSON.stringify(envelope.data.catalog)
    )
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBe(
      JSON.stringify(envelope.data.user)
    )
    expect(localStorage.getItem("remindit:locale")).toBe("ro")
    expect(localStorage.getItem("unrelated-key")).toBe("keep-me")
  })
})
