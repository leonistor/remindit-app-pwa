// AI context repository (Task B): read-only fetches of a team's list data for
// the server-executed `list`/`recommend` tools and the GET /api/ai/context
// contract. Every call runs on the caller's token-scoped PB client so PB's
// API rules (owner ∨ member) stay the authorization boundary — a non-member
// teamId simply returns no rows (and `getTeam` 404s first).
//
// Task B design (D15): writes are CLIENT-executed (the pwa's local stores),
// so this repository is strictly read-only — there is deliberately no create/
// update here.

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"
import { getTeam } from "./teams"

export type TeamContextRow = Record<string, unknown>

/** Verify access + return the team record (404 for non-members via PB rule). */
export const getTeamForContext = async (
  client: PocketBase,
  teamId: string
): Promise<TeamContextRow> => getTeam(client, teamId)

/** Categories for a team (sorted by name for stable tool output). */
export const listTeamCategories = async (
  client: PocketBase,
  teamId: string
): Promise<TeamContextRow[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.categories)
    .getFullList({
      filter: client.filter("team = {:teamId}", { teamId }),
      sort: "name",
    })
  return result as unknown as TeamContextRow[]
}

/** Catalog items for a team (sorted by name for stable tool output). */
export const listTeamItems = async (
  client: PocketBase,
  teamId: string
): Promise<TeamContextRow[]> => {
  const result = await client.collection(COLLECTION_NAMES.items).getFullList({
    filter: client.filter("team = {:teamId}", { teamId }),
    sort: "name",
  })
  return result as unknown as TeamContextRow[]
}

/**
 * Pending list entries pre-joined with item + category names via the
 * `list_entries_detailed` view (itemId, itemName, categoryId, categoryName,
 * checked, addedAt) — no expand chain needed.
 */
export const listTeamListEntries = async (
  client: PocketBase,
  teamId: string
): Promise<TeamContextRow[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.listEntriesDetailed)
    .getFullList({
      filter: client.filter("team = {:teamId}", { teamId }),
      sort: "+addedAt",
    })
  return result as unknown as TeamContextRow[]
}

/**
 * Full history log for a team. History rows are large-ish (append-only, every
 * add/remove), so this is fetched lazily only when the `recommend` tool runs.
 * itemId/categoryId are plain-text snapshots in the schema (deliberately not
 * relations), so no expand is needed.
 */
export const listTeamHistory = async (
  client: PocketBase,
  teamId: string
): Promise<TeamContextRow[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.historyEvents)
    .getFullList({
      filter: client.filter("team = {:teamId}", { teamId }),
      sort: "timestamp",
    })
  return result as unknown as TeamContextRow[]
}
