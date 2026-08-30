// Unit tests for the categories store (src/stores/categories).
//
// We import the submodules directly (NOT the `@/stores` barrel) because the
// barrel runs `initStores` + a dev logger as a side effect.
//
// happy-dom is configured globally, so `crypto.randomUUID()` and
// `localStorage` are available without extra setup.

import { beforeEach, describe, expect, it, test } from "@rstest/core"
import { PALETTE_SLOT_COUNT } from "@/lib/category-palette"
import {
  $categories,
  addCategory,
  assignCategoryColors,
  normalizeCategoryColors,
  renameCategory,
} from "@/stores/categories"
import type { CategoryFrequency } from "@/stores/types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

// Helper for building bare (colorless) categories for palette-slot assertions.
const CATS = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `cat-${i}`,
    name: `Category ${i}`,
    frequency: "weekly" as const,
  }))

describe("categories store", () => {
  beforeEach(resetStores)

  test("addCategory appends a category with a generated id and the given name", () => {
    const category = addCategory("Produce")

    const categories = $categories.get()
    expect(categories).toHaveLength(1)
    expect(categories[0]).toBe(category)
    expect(category.name).toBe("Produce")
    expect(typeof category.id).toBe("string")
    expect(category.id.length).toBeGreaterThan(0)
  })

  test("addCategory defaults frequency to 'unknown' when omitted", () => {
    const category = addCategory("Produce")
    expect(category.frequency).toBe("unknown")
  })

  test.each<CategoryFrequency>([
    "daily",
    "every-2-3-days",
    "weekly",
    "every-2-weeks",
    "monthly",
    "every-3-months",
    "seldom",
    "unknown",
  ])("addCategory honors an explicit frequency '%s'", (frequency) => {
    const category = addCategory("Produce", frequency)
    expect(category.frequency).toBe(frequency)
  })

  test("renameCategory updates the category name", () => {
    const category = addCategory("Produce")
    renameCategory(category.id, "Vegetables")

    const updated = $categories.get().find((c) => c.id === category.id)
    expect(updated?.name).toBe("Vegetables")
  })

  test("renameCategory is a no-op for UNCATEGORIZED_ID", () => {
    // Seed the sentinel so the no-op is observable.
    $categories.set([
      { id: UNCATEGORIZED_ID, name: "Uncategorized", frequency: "unknown" },
    ])

    renameCategory(UNCATEGORIZED_ID, "Renamed")

    const sentinel = $categories.get().find((c) => c.id === UNCATEGORIZED_ID)
    expect(sentinel?.name).toBe("Uncategorized")
  })
})

describe("assignCategoryColors", () => {
  it("assigns distinct sequential slots for <= palette-size categories", () => {
    const next = assignCategoryColors(CATS(PALETTE_SLOT_COUNT))
    const slots = next.map((c) => c.color)
    expect(slots).toHaveLength(PALETTE_SLOT_COUNT)
    expect(new Set(slots).size).toBe(PALETTE_SLOT_COUNT)
    expect(slots).toEqual(Array.from({ length: PALETTE_SLOT_COUNT }, (_, i) => i))
  })

  it("leaves the uncategorized sentinel without a color", () => {
    const next = assignCategoryColors([
      { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, frequency: "unknown" },
      ...CATS(3),
    ])
    expect(next[0].color).toBeUndefined()
    expect(new Set(next.slice(1).map((c) => c.color)).size).toBe(3)
  })

  it("keeps existing valid slots and only fills the gaps", () => {
    const input = [
      { id: "cat-a", name: "A", frequency: "weekly" as const, color: 2 },
      { id: "cat-b", name: "B", frequency: "weekly" as const },
      { id: "cat-c", name: "C", frequency: "weekly" as const },
    ]
    const next = assignCategoryColors(input)
    expect(next[0].color).toBe(2)
    const rest = next.slice(1).map((c) => c.color)
    expect(new Set(rest).size).toBe(2)
    expect(rest).not.toContain(2)
  })

  it("wraps once every slot is taken (palette ceiling)", () => {
    const next = assignCategoryColors(CATS(PALETTE_SLOT_COUNT + 2))
    const slots = next.map((c) => c.color)
    // 12 distinct + 2 reused → 14 slots but only 12 unique values.
    expect(slots).toHaveLength(PALETTE_SLOT_COUNT + 2)
    expect(new Set(slots).size).toBe(PALETTE_SLOT_COUNT)
  })
})

describe("addCategory color slot", () => {
  beforeEach(() => $categories.set([]))

  it("assigns an in-range, distinct color slot", () => {
    const a = addCategory("A")
    const b = addCategory("B")
    expect(a.color).toBeGreaterThanOrEqual(0)
    expect(a.color).toBeLessThan(PALETTE_SLOT_COUNT)
    expect(b.color).not.toBe(a.color)
  })
})

describe("normalizeCategoryColors", () => {
  beforeEach(() => $categories.set([]))

  it("backfills missing slots without overwriting existing ones", () => {
    $categories.set([
      { id: "cat-a", name: "A", frequency: "weekly", color: 5 },
      { id: "cat-b", name: "B", frequency: "weekly" },
      { id: "cat-c", name: "C", frequency: "weekly" },
    ])
    normalizeCategoryColors()
    const next = $categories.get()
    expect(next[0].color).toBe(5)
    const rest = next.slice(1).map((c) => c.color)
    expect(new Set(rest).size).toBe(2)
    expect(rest).not.toContain(5)
  })
})
