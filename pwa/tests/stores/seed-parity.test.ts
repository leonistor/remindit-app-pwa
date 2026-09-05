// Parity test: the pwa seed path and the shared common seed path must produce
// IDENTICAL output for identical input. The pwa's `generateShoppingHistory`
// now delegates to common's `generateTeamHistory`, so this guards against any
// future drift between the pwa-facing wrapper (defaults/option shape) and the
// shared simulator (algorithm/ids), and proves the de-duplication refactor
// preserved behavior.

import { describe, expect, test } from "@rstest/core"
import {
  FREQ_TO_DAYS as commonFreqToDays,
  generateTeamHistory,
} from "@remindit/common/seeds"
import { generateShoppingHistory } from "seed/history"
import type { CatalogItem, Category, HistoryEvent } from "@/stores/types"

const FIXED_NOW = new Date("2026-01-01T00:00:00Z").getTime()

const CATEGORIES: Category[] = [
  { id: "cat-fridge", name: "Fridge", frequency: "weekly" },
  { id: "cat-pantry", name: "Pantry", frequency: "monthly" },
  { id: "cat-seldom", name: "Rare", frequency: "seldom" },
]

const CATALOG: CatalogItem[] = [
  { id: "item-milk", name: "Milk", categoryId: "cat-fridge" },
  { id: "item-eggs", name: "Eggs", categoryId: "cat-fridge" },
  { id: "item-oil", name: "Olive Oil", categoryId: "cat-pantry" },
  { id: "item-rare", name: "Vase", categoryId: "cat-seldom" },
]

describe("seed parity (pwa ↔ common)", () => {
  test("pwa and common history generators emit identical events for identical input", () => {
    const opts = { catalog: CATALOG, categories: CATEGORIES, days: 30, seed: 7, now: FIXED_NOW }

    const pwaEvents = generateShoppingHistory(opts)
    const commonEvents = generateTeamHistory(CATALOG, CATEGORIES, {
      days: 30,
      seed: 7,
      now: FIXED_NOW,
    })

    expect(pwaEvents).toHaveLength(commonEvents.length)
    for (let i = 0; i < pwaEvents.length; i++) {
      const a = pwaEvents[i] as HistoryEvent
      const b = commonEvents[i] as HistoryEvent
      expect(a.id).toBe(b.id)
      expect(a.action).toBe(b.action)
      expect(a.itemId).toBe(b.itemId)
      expect(a.itemName).toBe(b.itemName)
      expect(a.categoryId).toBe(b.categoryId)
      expect(a.categoryName).toBe(b.categoryName)
      expect(a.timestamp).toBe(b.timestamp)
    }
    expect(pwaEvents).toEqual(commonEvents)
  })

  test("common FREQ_TO_DAYS matches the recommender's expected literal values", () => {
    expect(commonFreqToDays.weekly).toBe(7)
    expect(commonFreqToDays.monthly).toBe(30)
    expect(commonFreqToDays.seldom).toBe(180)
    expect(commonFreqToDays.unknown).toBe(14)
  })
})
