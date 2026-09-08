// AI context service (Task B) — mapping, recommendations, and tool-result
// formatting against a stubbed PB (real `client.filter`, no network). The
// same fake pattern as `helpers/fake-conversations-pb.ts`; the storage
// adapter id-semantics fix is covered in `voltagent-storage.test.ts`.

import { describe, expect, test } from "bun:test"
import PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../src/schema/collections"
import {
  buildAIContext,
  formatListForTool,
  formatRecommendationsForTool,
} from "../src/services/ai-context"

const rowsFor = (name: string, rows: Record<string, unknown>[]) => {
  const collection = {
    getOne: async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) throw new Error("404")
      return row
    },
    getFullList: async () => rows,
  }
  return collection
}

const makePb = () => {
  const state = {
    teams: [] as Record<string, unknown>[],
    categories: [] as Record<string, unknown>[],
    items: [] as Record<string, unknown>[],
    listEntries: [] as Record<string, unknown>[],
    history: [] as Record<string, unknown>[],
  }
  const client = new PocketBase("http://fake.invalid")
  const realCollection = client.collection.bind(client)
  // Narrow override: the context repo only calls getFullList/getOne. Cast to
  // the SDK's collection-method type (tests-only, matching the conversations
  // fake pattern).
  client.collection = ((name: string) => {
    switch (name) {
      case COLLECTION_NAMES.teams:
        return rowsFor(name, state.teams)
      case COLLECTION_NAMES.categories:
        return rowsFor(name, state.categories)
      case COLLECTION_NAMES.items:
        return rowsFor(name, state.items)
      case COLLECTION_NAMES.listEntriesDetailed:
        return rowsFor(name, state.listEntries)
      case COLLECTION_NAMES.historyEvents:
        return rowsFor(name, state.history)
      default:
        return realCollection(name)
    }
  }) as typeof client.collection
  return { client, state }
}

const category = (id: string, name: string, frequency = "weekly") => ({
  id,
  name,
  frequency,
})

const sampleState = () => {
  const pb = makePb()
  pb.state.teams = [{ id: "t1", name: "The Popescu household" }]
  pb.state.categories = [
    category("c1", "frigider", "weekly"),
    category("c2", "seldom-cat", "seldom"),
  ]
  pb.state.items = [
    { id: "i1", name: "Lapte", category: "c1" },
    { id: "i2", name: "Pâine", category: "c1" },
  ]
  pb.state.listEntries = [
    {
      itemId: "i2",
      itemName: "Pâine",
      categoryId: "c1",
      categoryName: "frigider",
      checked: false,
      addedAt: 1_700_000_000_000,
    },
  ]
  // i1 (Lapte) was added 15 days ago and is NOT on the list → recommendable
  // (weekly cadence, overdue). i2 is on the list and i3 has no history.
  const now = Date.now()
  pb.state.items.push({ id: "i3", name: "Ouă", category: "c1" })
  pb.state.history = [
    {
      id: "h1",
      action: "add",
      itemId: "i1",
      itemName: "Lapte",
      categoryId: "c1",
      categoryName: "frigider",
      timestamp: now - 15 * 86_400_000,
    },
  ]
  return pb
}

describe("buildAIContext", () => {
  test("maps team data and derives the recommendation set", async () => {
    const { client, state } = sampleState()
    const ctx = await buildAIContext(client, "t1")

    expect(ctx.team).toEqual({ id: "t1", name: "The Popescu household" })
    expect(ctx.categories).toEqual([
      { id: "c1", name: "frigider", frequency: "weekly" },
      { id: "c2", name: "seldom-cat", frequency: "seldom" },
    ])
    expect(ctx.catalog).toEqual([
      { id: "i1", name: "Lapte", categoryId: "c1" },
      { id: "i2", name: "Pâine", categoryId: "c1" },
      { id: "i3", name: "Ouă", categoryId: "c1" },
    ])
    expect(ctx.list).toEqual([
      {
        itemId: "i2",
        itemName: "Pâine",
        categoryId: "c1",
        categoryName: "frigider",
        checked: false,
        addedAt: 1_700_000_000_000,
      },
    ])
    // i1 was bought 15d ago (weekly cadence → overdue) and isn't on the list,
    // so it is recommendable; the on-list item, "seldom" category, and
    // no-history items are excluded by the shared engine.
    expect(ctx.recommendations.map((r) => r.itemId)).toEqual(["i1"])
    expect(ctx.recommendations[0].tier).toBe("overdue")
  })
})

describe("formatListForTool", () => {
  test("lists unchecked entries with their category", async () => {
    const { client } = sampleState()
    const ctx = await buildAIContext(client, "t1")
    const out = formatListForTool(ctx)
    expect(out).toContain("Pâine")
    expect(out).toContain("frigider")
    expect(out).not.toContain("Lapte") // not on the list
  })

  test("empty list → friendly message", async () => {
    const pb = makePb()
    pb.state.teams = [{ id: "t1", name: "T" }]
    const ctx = await buildAIContext(pb.client, "t1")
    expect(formatListForTool(ctx)).toContain("empty")
  })
})

describe("formatRecommendationsForTool", () => {
  test("formats the top suggestions with tiers", async () => {
    const { client } = sampleState()
    const ctx = await buildAIContext(client, "t1")
    const out = formatRecommendationsForTool(ctx)
    expect(out).toContain("Lapte")
    expect(out).toContain("overdue")
  })

  test("no recommendations → friendly message", async () => {
    const pb = makePb()
    pb.state.teams = [{ id: "t1", name: "T" }]
    const ctx = await buildAIContext(pb.client, "t1")
    expect(formatRecommendationsForTool(ctx)).toContain("No recommendations")
  })
})
