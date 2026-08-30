// Unit tests for the quick-add source-list builder (src/lib/quick-add).

import { describe, expect, it } from "@rstest/core"
import {
  buildItems,
  isNewValue,
  NEW_CATEGORY_ID,
  NEW_VALUE_PREFIX,
} from "@/lib/quick-add"

const catalogGroups = [
  {
    categoryId: "cat-produce",
    categoryName: "Produce",
    items: [
      { id: "i1", name: "Apple", categoryId: "cat-produce" },
      { id: "i2", name: "Banana", categoryId: "cat-produce" },
    ],
  },
  {
    categoryId: "cat-dairy",
    categoryName: "Dairy",
    items: [{ id: "i3", name: "Milk", categoryId: "cat-dairy" }],
  },
]

describe("buildItems", () => {
  it("mirrors the catalog groups in order when not recommended-only", () => {
    const items = buildItems(false, [], catalogGroups, new Map())

    expect(items).toEqual([
      { value: "i1", label: "Apple", categoryId: "cat-produce", categoryName: "Produce" },
      { value: "i2", label: "Banana", categoryId: "cat-produce", categoryName: "Produce" },
      { value: "i3", label: "Milk", categoryId: "cat-dairy", categoryName: "Dairy" },
    ])
  })

  it("groups recommendations by category in the given rank order", () => {
    const recs = [
      { item: { id: "r1", name: "Oat", categoryId: "cat-dairy" }, categoryName: "Dairy", score: 2 },
      { item: { id: "r2", name: "Onion", categoryId: "cat-produce" }, categoryName: "Produce", score: 1 },
    ]
    const rank = new Map([
      ["cat-produce", 1],
      ["cat-dairy", 0],
    ])

    // Dairy has the lower (earlier) rank, so its recommendation comes first.
    const items = buildItems(true, recs, catalogGroups, rank)
    expect(items.map((i) => i.value)).toEqual(["r1", "r2"])
  })

  it("flattens recommendations in source order when no rank is supplied", () => {
    const recs = [
      { item: { id: "r1", name: "Oat", categoryId: "cat-dairy" }, categoryName: "Dairy", score: 2 },
      { item: { id: "r2", name: "Onion", categoryId: "cat-produce" }, categoryName: "Produce", score: 1 },
    ]

    const items = buildItems(true, recs, catalogGroups, new Map())
    expect(items.map((i) => i.value)).toEqual(["r1", "r2"])
  })
})

describe("isNewValue", () => {
  it("recognizes only the create-new prefix", () => {
    expect(isNewValue(`${NEW_VALUE_PREFIX}Apple`)).toBe(true)
    expect(isNewValue("Apple")).toBe(false)
  })
})

describe("sentinel constants", () => {
  it("exposes the create-new category id", () => {
    expect(NEW_CATEGORY_ID).toBe("__new__")
  })
})
