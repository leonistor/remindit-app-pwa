// AI context service (Task B): assembles the authed user's team context for
// the app-commands slice (D15) — the current list, catalog, categories, and
// the recommendation set — from the token-scoped PB client. The pure scoring
// is shared with the pwa via `@remindit/common/recommender` (hoisted so the
// BFF and the pwa compute identical recommendations).
//
// Format helpers turn the context into the tool-result text the model reads
// for the server-executed `list_items` / `recommend_items` tools (the `add`
// tool stays client-executed; see services/ai.ts).

import type {
  CatalogItem,
  Category,
  HistoryEvent,
  Recommendation,
} from "@remindit/common/models"
import { UNCATEGORIZED_NAME } from "@remindit/common/models"
import { computeRecommendations } from "@remindit/common/recommender"
import type PocketBase from "pocketbase"
import type { AIContext } from "../contracts"
import {
  getTeamForContext,
  listTeamCategories,
  listTeamHistory,
  listTeamItems,
  listTeamListEntries,
} from "../repositories/context"

export type AIContextRow = AIContext

/** Frequency values are stored as slugs — identical to common's enum. */
const asCategory = (row: Record<string, unknown>): Category => ({
  id: row.id as string,
  name: row.name as string,
  frequency: row.frequency as Category["frequency"],
  color: row.color as number | undefined,
})

const asCatalogItem = (row: Record<string, unknown>): CatalogItem => ({
  id: row.id as string,
  name: row.name as string,
  categoryId: row.category as string,
})

const asHistoryEvent = (row: Record<string, unknown>): HistoryEvent => ({
  id: row.id as string,
  action: row.action as HistoryEvent["action"],
  itemId: row.itemId as string,
  itemName: row.itemName as string,
  categoryId: row.categoryId as string,
  categoryName: row.categoryName as string,
  timestamp: row.timestamp as number,
})

/**
 * Fetch a team's AI context. Throws (PB 404) when the caller isn't a member —
 * the route pre-flights with `getTeamForContext` and PB's viewRule.
 */
export const buildAIContext = async (
  client: PocketBase,
  teamId: string
): Promise<AIContext> => {
  const team = await getTeamForContext(client, teamId)

  const categoryRows = await listTeamCategories(client, teamId)
  const itemRows = await listTeamItems(client, teamId)
  const entryRows = await listTeamListEntries(client, teamId)
  const historyRows = await listTeamHistory(client, teamId)

  const categories = categoryRows.map(asCategory)
  const catalog = itemRows.map(asCatalogItem)
  const history = historyRows.map(asHistoryEvent)

  // Pending list = unchecked entries; the view gives us item + category names.
  const list = entryRows.map((row) => ({
    itemId: row.itemId as string,
    itemName: row.itemName as string,
    categoryId: row.categoryId as string,
    categoryName: row.categoryName as string,
    checked: (row.checked as boolean) ?? false,
    addedAt: row.addedAt as number,
  }))

  const recommendations = computeRecommendations(
    history,
    catalog,
    categories,
    list.map((entry) => ({ itemId: entry.itemId }))
  ).map(toRecommendationContract)

  return {
    team: { id: team.id as string, name: team.name as string },
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      frequency: c.frequency,
    })),
    catalog: catalog.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
    })),
    list,
    recommendations,
  }
}

const toRecommendationContract = (
  r: Recommendation
): AIContext["recommendations"][0] => ({
  itemId: r.item.id,
  itemName: r.item.name,
  categoryId: r.item.categoryId,
  categoryName: r.categoryName,
  tier: r.tier,
  score: r.score,
})

// ---------------------------------------------------------------------------
// Tool-result formatting (what the model reads)
// ---------------------------------------------------------------------------

/**
 * Human-readable current list for the `list_items` tool result. Unchecked
 * (pending) entries are what "the list" means here; checked entries are the
 * just-bought ones.
 */
export const formatListForTool = (ctx: AIContext): string => {
  const pending = ctx.list.filter((entry) => !entry.checked)
  if (pending.length === 0) return "The shopping list is empty."
  const lines = pending.map((entry) => {
    const category = entry.categoryName || UNCATEGORIZED_NAME
    return `- ${entry.itemName} (${category})`
  })
  return `Current shopping list:\n${lines.join("\n")}`
}

/** Top recommendations for the `recommend_items` tool result. */
export const formatRecommendationsForTool = (ctx: AIContext): string => {
  if (ctx.recommendations.length === 0) {
    return "No recommendations yet — there isn't enough shopping history."
  }
  const lines = ctx.recommendations.slice(0, 10).map((r) => {
    const tierLabel =
      r.tier === "overdue"
        ? "overdue"
        : r.tier === "soon"
          ? "due soon"
          : "regular"
    return `- ${r.itemName} (${r.categoryName}, ${tierLabel})`
  })
  return `Recommended next buys:\n${lines.join("\n")}`
}
