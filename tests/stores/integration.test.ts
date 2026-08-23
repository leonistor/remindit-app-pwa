// Integration tests across the shopping stores.
//
// We import each submodule directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect. happy-dom is the
// global test environment (see rstest.config.ts), so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.
//
// Note: `$history` is exported from `@/stores/history` (the module that owns
// it), while `addToList` / `removeFromList` and `$list` live in
// `@/stores/list`. The seeds come from `tests/fixtures/history`, which derives
// deterministic IDs that line up with `shoppingHistory3mo`.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $categories } from "@/stores/categories"
import { $catalog } from "@/stores/catalog"
// `$history` is owned by the history store; `addToList` / `removeFromList` and
// `$list` live in list.ts. `$list` is needed to recover the entry id created by
// `addToList` for the removal step.
import { $history } from "@/stores/history"
import { $list, addToList, removeFromList } from "@/stores/list"
import { buildSeedData, shoppingHistory3mo } from "../fixtures/history"
import { resetStores } from "../fixtures/reset"

const THREE_MONTHS_MS = 90 * 86_400_000

describe("store integration", () => {
  beforeEach(resetStores)

  test("seed data is internally consistent with the 3-month history", () => {
    const { categories, catalog } = buildSeedData()

    // Populate the stores from the seed.
    $categories.set(categories)
    $catalog.set(catalog)
    $history.set(shoppingHistory3mo)

    // The seeded history must be non-empty so the assertions below are meaningful.
    expect(shoppingHistory3mo.length).toBeGreaterThan(0)

    // Index the seed ids for membership checks.
    const categoryIds = new Set(categories.map((c) => c.id))
    const catalogIds = new Set(catalog.map((i) => i.id))

    const now = Date.now()
    const windowStart = now - THREE_MONTHS_MS

    for (const event of shoppingHistory3mo) {
      // Every event references a category and an item that actually exist in
      // the seeded stores. The ids are derived deterministically, so this
      // guarantees the seed and the generated history agree.
      expect(categoryIds.has(event.categoryId)).toBe(true)
      expect(catalogIds.has(event.itemId)).toBe(true)

      // Every event falls within the trailing 90-day window and never in the
      // future.
      expect(event.timestamp).toBeLessThanOrEqual(now)
      expect(event.timestamp).toBeGreaterThanOrEqual(windowStart)
    }
  })

  test("live add/remove flow writes independent history events", () => {
    const { categories, catalog } = buildSeedData()

    // Seed only the catalog + categories (the live flow is independent of the
    // seeded 3-month history, which we deliberately leave unset).
    $categories.set(categories)
    $catalog.set(catalog)

    const itemId = catalog[0].id

    // Prior to any interaction the history is empty.
    expect($history.get()).toEqual([])

    // Adding the item logs exactly one 'add' event.
    addToList(itemId)
    const afterAdd = $history.get()
    expect(afterAdd).toHaveLength(1)
    expect(afterAdd[0].action).toBe("add")
    expect(afterAdd[0].itemId).toBe(itemId)
    expect(typeof afterAdd[0].id).toBe("string")
    expect(afterAdd[0].id.length).toBeGreaterThan(0)
    expect(typeof afterAdd[0].timestamp).toBe("number")

    // Recover the freshly created list entry so we can remove it.
    const entry = $list.get().find((e) => e.itemId === itemId)
    expect(entry).toBeDefined()
    const entryId = entry ? entry.id : ""

    // Removing that entry logs exactly one 'remove' event, appended after the
    // add, referencing the same item.
    removeFromList(entryId)
    const afterRemove = $history.get()
    expect(afterRemove).toHaveLength(2)
    expect(afterRemove[1].action).toBe("remove")
    expect(afterRemove[1].itemId).toBe(itemId)
    expect(afterRemove[1].id).not.toBe(afterRemove[0].id)

    // Sanity: the live events are a clean add→remove pair with no stray data.
    expect(afterRemove.map((e) => e.action)).toEqual(["add", "remove"])
  })
})
