// Schema-builder integrity checks (no PocketBase needed): the builders are
// the migration source of truth, so structural mistakes must fail here before
// any live reconcile is attempted.

import { describe, expect, test } from "bun:test"
import { CATEGORY_FREQUENCIES, UNCATEGORIZED_NAME } from "@remindit/common"
import {
  desiredCollections,
  SENTINEL_CATEGORY_NAME,
} from "../src/schema/collections"

describe("pb schema builders", () => {
  test("collection names are unique", () => {
    const names = desiredCollections.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test("relation targets exist by the time each collection is defined", () => {
    // `users` is created by PocketBase itself in every instance.
    const defined = new Set(["users"])
    for (const collection of desiredCollections) {
      for (const field of collection.fields) {
        if (field.type === "relation") {
          expect(defined.has(field.collectionName ?? "")).toBe(true)
        }
      }
      defined.add(collection.name)
    }
  })

  test("category frequency values mirror common CATEGORY_FREQUENCIES", () => {
    const categories = desiredCollections.find((c) => c.name === "categories")
    const frequency = categories?.fields.find((f) => f.name === "frequency")
    expect(frequency?.values).toEqual([...CATEGORY_FREQUENCIES])
  })

  test("history action values mirror common HistoryAction", () => {
    const history = desiredCollections.find((c) => c.name === "history_events")
    const action = history?.fields.find((f) => f.name === "action")
    expect(action?.values).toEqual(["add", "remove"])
  })

  test("sentinel category name comes from common", () => {
    expect(SENTINEL_CATEGORY_NAME).toBe(UNCATEGORIZED_NAME)
  })
})
