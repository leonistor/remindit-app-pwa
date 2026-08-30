// Unit tests for category palette-slot assignment (Option A: sequential,
// distinct coloring up to the palette size).
//
// `assignCategoryColors` / `normalizeCategoryColors` are pure-ish helpers over
// the $categories store; we drive them directly and reset the store per test.

import { beforeEach, describe, expect, it } from "@rstest/core"
import {
  $categories,
  addCategory,
  assignCategoryColors,
  normalizeCategoryColors,
} from "@/stores/categories"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "@/stores/types"
import { PALETTE_SLOT_COUNT } from "@/lib/category-palette"

const CATS = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `cat-${i}`,
    name: `Category ${i}`,
    frequency: "weekly" as const,
  }))

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

describe("addCategory", () => {
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
