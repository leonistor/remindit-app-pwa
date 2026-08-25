// Tests for the seed dataset registry and loader (seed/index.ts).
//
// happy-dom is configured globally. Imports the seed loader via the `seed`
// tsconfig alias.

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import {
  DATASETS,
  DEFAULT_DATASET_ID,
  getDataset,
  resolveDatasetId,
} from "seed"
import { UNCATEGORIZED_ID } from "@/stores/types"

describe("seed datasets", () => {
  test("registry tracks every dataset with id, name and file", () => {
    expect(DATASETS).toHaveLength(3)

    const ids = DATASETS.map((d) => d.id)
    expect(ids).toContain("items_categories")
    expect(ids).toContain("leo_romanian")
    expect(ids).toContain("rick_morty")

    for (const d of DATASETS) {
      expect(typeof d.name).toBe("string")
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.file).toMatch(/\.json$/)
    }
    expect(DEFAULT_DATASET_ID).toBe("items_categories")
  })

  test("default dataset keeps stable ids and curated frequencies", () => {
    const { categories, catalog } = getDataset("items_categories")
    const fridge = categories.find((c) => c.name === "fridge")
    expect(fridge?.frequency).toBe("weekly")
    const milk = catalog.find((i) => i.name === "milk")
    expect(milk?.categoryId).toBe(fridge?.id)
  })

  test("items without a category resolve to uncategorized, no empty category", () => {
    const { categories, catalog } = getDataset("rick_morty")

    const orphaned = catalog.filter(
      (i) => !categories.some((c) => c.id === i.categoryId)
    )
    // All 7 empty-category rows land in the uncategorized sentinel.
    expect(orphaned).toHaveLength(7)
    expect(orphaned.every((i) => i.categoryId === UNCATEGORIZED_ID)).toBe(true)
    // And no broken empty-named category is created.
    expect(categories.every((c) => c.name.length > 0)).toBe(true)
  })
})

describe("resolveDatasetId", () => {
  const originalWarn = console.warn

  beforeEach(() => {
    // Silence the fallback warning except where we assert on it.
    console.warn = () => {}
  })
  afterEach(() => {
    console.warn = originalWarn
  })

  const validIds = DATASETS.map((d) => d.id)

  test("passes through a registered dataset id", () => {
    for (const id of validIds) {
      expect(resolveDatasetId(id)).toBe(id)
    }
  })

  test("falls back to DEFAULT_DATASET_ID when empty or undefined", () => {
    expect(resolveDatasetId("")).toBe(DEFAULT_DATASET_ID)
    expect(resolveDatasetId(undefined)).toBe(DEFAULT_DATASET_ID)
  })

  test("falls back to DEFAULT_DATASET_ID and warns on an unknown id", () => {
    const calls: string[] = []
    console.warn = (msg: string) => calls.push(msg)

    expect(resolveDatasetId("nope")).toBe(DEFAULT_DATASET_ID)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("nope")
    expect(calls[0]).toContain(DEFAULT_DATASET_ID)
  })
})
