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

  test("view collections are read-only: query present, no fields/indexes, null mutation rules", () => {
    const views = desiredCollections.filter((c) => c.type === "view")
    expect(views.length).toBeGreaterThan(0)
    for (const view of views) {
      expect(view.viewQuery?.trim()).toBeTruthy()
      expect(view.fields).toEqual([])
      expect(view.indexes ?? []).toEqual([])
      expect(view.createRule ?? null).toBeNull()
      expect(view.updateRule ?? null).toBeNull()
      expect(view.deleteRule ?? null).toBeNull()
    }
  })

  test("every view query selects an id column (PB requirement)", () => {
    for (const view of desiredCollections.filter((c) => c.type === "view")) {
      expect(view.viewQuery).toMatch(/SELECT/i)
      expect(view.viewQuery).toMatch(/\bid\b/)
    }
  })

  test("view queries only reference known collections", () => {
    const known = new Set([
      "users", // created by PocketBase itself in every instance
      ...desiredCollections
        .filter((c) => c.type !== "view")
        .map((c) => c.name),
    ])
    for (const view of desiredCollections.filter((c) => c.type === "view")) {
      const refs = [
        ...(view.viewQuery ?? "").matchAll(/(?:FROM|JOIN)\s+([a-z_]+)/gi),
      ].map((match) => match[1])
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) {
        expect(known.has(ref)).toBe(true)
      }
    }
  })

  test("views are declared after every base/auth collection (structure pass creates tables before views)", () => {
    const firstView = desiredCollections.findIndex((c) => c.type === "view")
    const lastBase = desiredCollections.reduce(
      (last, c, i) => (c.type === "view" ? last : i),
      -1
    )
    expect(firstView).toBeGreaterThan(-1)
    expect(firstView).toBeGreaterThan(lastBase)
  })
})
