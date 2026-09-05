// Platform seeder core — writes the typed dataset (from `@remindit/common/seeds`)
// into PocketBase via the superuser client, idempotently.
//
// Upsert order matters:
//   1. users (key: unique `username` index)        → skip if present
//   2. teams + owner membership + sentinel (key: owner + name filter)
//   3. team members (key: unique (team, user) index) → only for fresh teams
//   4. categories / items (key: unique (team, localId), pwa-scheme ids)
//   5. list_entries + simulated history (key: (team, localId))
// Re-running any step is a no-op except the member notifications (dispatched
// only for memberships actually created this run).
//
// Pure of env/CLI concerns so it is unit/live-testable (`bun:test` against a
// real PB via `forSuperuser`). The thin CLI lives in `bff/scripts/seed.ts`.

import { NOTIFICATION_TYPES, UNCATEGORIZED_ID } from "@remindit/common"
import {
  generateTeamHistory,
  hashId,
  teamLocalIds,
} from "@remindit/common/seeds"
import type { SeedPlatform } from "@remindit/common/seeds"
import type PocketBase from "pocketbase"
import { dispatch } from "../services/notifications"
import { provisionTeam } from "../services/provision"

export interface SeedSummary {
  created: {
    users: string[]
    teams: string[]
    members: string[]
  }
  existing: {
    users: string[]
    teams: string[]
  }
  content: {
    categories: number
    items: number
    listEntries: number
    historyEvents: number
  }
  notifications: number
}

export interface SeedOptions {
  /** Reference "now" (ms) for list timestamps + history simulation. */
  now?: number
}

const EMPTY_SUMMARY = (): SeedSummary => ({
  created: { users: [], teams: [], members: [] },
  existing: { users: [], teams: [] },
  content: { categories: 0, items: 0, listEntries: 0, historyEvents: 0 },
  notifications: 0,
})

export async function seedPlatform(
  pb: PocketBase,
  dataset: SeedPlatform,
  opts: SeedOptions = {}
): Promise<SeedSummary> {
  const summary = EMPTY_SUMMARY()
  const now = opts.now ?? Date.now()

  // --- users (unique index on username) -------------------------------------
  const userIdByUsername = new Map<string, string>()
  for (const user of dataset.users) {
    const existing = await pb.collection("users").getFullList({
      filter: pb.filter("username = {:u}", { u: user.username }),
    })
    if (existing.length > 0) {
      summary.existing.users.push(user.username)
      userIdByUsername.set(user.username, existing[0].id as string)
      continue
    }
    const record = (await pb.collection("users").create({
      email: user.email,
      password: dataset.password,
      passwordConfirm: dataset.password,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
    })) as unknown as { id: string }
    summary.created.users.push(user.username)
    userIdByUsername.set(user.username, record.id)
  }

  // --- teams + per-team content ---------------------------------------------
  for (const team of dataset.teams) {
    const ownerId = userIdByUsername.get(team.ownerUsername)
    if (!ownerId) {
      throw new Error(
        `[seed] team "${team.name}" has no resolved owner "${team.ownerUsername}"`
      )
    }

    // No unique index on (owner, name) — guard by existence filter.
    const existingTeams = await pb.collection("teams").getFullList({
      filter: pb.filter("owner = {:owner} && name = {:name}", {
        owner: ownerId,
        name: team.name,
      }),
    })
    if (existingTeams.length > 0) {
      summary.existing.teams.push(team.name)
      continue
    }

    const { team: teamRecord, sentinel } = await provisionTeam(
      pb,
      ownerId,
      team.name
    )
    summary.created.teams.push(team.name)
    const teamId = teamRecord.id as string

    // --- members (owner membership already created by provisionTeam) --------
    const memberUserIds: string[] = []
    for (const username of team.memberUsernames) {
      const userId = userIdByUsername.get(username)
      if (!userId) continue
      await pb.collection("team_members").create({
        team: teamId,
        user: userId,
        role: "member",
      })
      summary.created.members.push(username)
      memberUserIds.push(userId)
    }

    // --- catalog content (pwa-scheme local ids ⇒ identical pwa reconcile) ---
    // Local categories/catalog first so the seeder and the history generator
    // share the exact ids a pwa would generate for the same names.
    const { categories, catalog } = teamLocalIds(team)
    const categoryPbIdByLocalId = new Map<string, string>()
    if (sentinel) {
      categoryPbIdByLocalId.set(UNCATEGORIZED_ID, sentinel.id as string)
    }
    for (const [index, category] of categories.entries()) {
      const record = (await pb.collection("categories").create({
        team: teamId,
        name: category.name,
        frequency: category.frequency,
        color: index,
        localId: category.id,
      })) as unknown as { id: string }
      categoryPbIdByLocalId.set(category.id, record.id)
      summary.content.categories += 1
    }

    const itemPbIdByName = new Map<string, string>()
    for (const item of catalog) {
      const categoryPbId = categoryPbIdByLocalId.get(item.categoryId)
      if (!categoryPbId) {
        throw new Error(
          `[seed] no pb category id for "${item.categoryId}" (team "${team.name}")`
        )
      }
      const record = (await pb.collection("items").create({
        team: teamId,
        name: item.name,
        category: categoryPbId,
        localId: item.id,
      })) as unknown as { id: string }
      itemPbIdByName.set(item.name, record.id)
      summary.content.items += 1
    }

    // --- the current shared list (all unchecked, "needs a shop") ------------
    for (const name of team.listItemNames) {
      const itemPbId = itemPbIdByName.get(name)
      if (!itemPbId) continue
      await pb.collection("list_entries").create({
        team: teamId,
        item: itemPbId,
        checked: false,
        addedAt: now,
        localId: hashId(`entry::${name}`),
      })
      summary.content.listEntries += 1
    }

    // --- simulated history (deterministic; feeds the recommender + overview) -
    const events = generateTeamHistory(catalog, categories, {
      days: team.history.days,
      seed: team.history.seed,
      now,
    })
    for (const event of events) {
      await pb.collection("history_events").create({
        team: teamId,
        action: event.action,
        itemId: event.itemId,
        itemName: event.itemName,
        categoryId: event.categoryId,
        categoryName: event.categoryName,
        // PB's `timestamp` is onlyInt; session "remove" events carry float ms
        // (cumulated session spans in the generator) — snap to integer ms.
        timestamp: Math.round(event.timestamp),
        localId: event.id,
      })
      summary.content.historyEvents += 1
    }

    // Lifecycle notifications (D4) — dispatch is superuser-side, best-effort.
    for (const userId of memberUserIds) {
      await dispatch(userId, teamId, NOTIFICATION_TYPES.memberAdded, {
        teamId,
        teamName: team.name,
        actorUsername: team.ownerUsername,
      })
      summary.notifications += 1
    }
  }

  return summary
}