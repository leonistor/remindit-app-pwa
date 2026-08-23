// Unit tests for the history store (src/stores/history).
//
// We import the submodule directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.

import { beforeEach, describe, expect, test } from "@rstest/core"
import { $history, clearHistory, logHistory } from "@/stores/history"
import { resetStores } from "../fixtures/reset"

describe("history store", () => {
  beforeEach(resetStores)

  test("logHistory appends one event with the provided fields", () => {
    const input = {
      action: "add" as const,
      itemId: "item-1",
      itemName: "Milk",
      categoryId: "cat-dairy",
    }

    const event = logHistory(input)

    const events = $history.get()
    expect(events).toHaveLength(1)
    expect(events[0]).toBe(event)

    // The four provided fields must match the input exactly.
    expect(event.action).toBe("add")
    expect(event.itemId).toBe("item-1")
    expect(event.itemName).toBe("Milk")
    expect(event.categoryId).toBe("cat-dairy")

    // id and timestamp are generated, so assert only their types/shapes.
    expect(typeof event.id).toBe("string")
    expect(event.id.length).toBeGreaterThan(0)
    expect(typeof event.timestamp).toBe("number")
  })

  test("clearHistory empties $history back to []", () => {
    logHistory({
      action: "add",
      itemId: "item-1",
      itemName: "Milk",
      categoryId: "cat-dairy",
    })
    expect($history.get()).toHaveLength(1)

    clearHistory()

    expect($history.get()).toEqual([])
  })

  test("logHistory twice yields two events, both present", () => {
    const first = logHistory({
      action: "add",
      itemId: "item-1",
      itemName: "Milk",
      categoryId: "cat-dairy",
    })
    const second = logHistory({
      action: "remove",
      itemId: "item-2",
      itemName: "Bread",
      categoryId: "cat-bakery",
    })

    const events = $history.get()
    expect(events).toHaveLength(2)

    const ids = events.map((e) => e.id)
    expect(ids).toContain(first.id)
    expect(ids).toContain(second.id)

    // Order preserved, distinct actions recorded.
    expect(events[0].id).toBe(first.id)
    expect(events[0].action).toBe("add")
    expect(events[1].id).toBe(second.id)
    expect(events[1].action).toBe("remove")
  })
})
