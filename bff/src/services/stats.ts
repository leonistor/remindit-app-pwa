// Public, aggregate-only stats for the marketing site (phase 4): total users
// and groups. Counting runs superuser-side (anonymous visitors cannot list
// users/groups — PB rules stay intact) and is cached briefly so the marketing
// pages never hammer PB.
import type { Stats } from "../contracts"
import { forSuperuser } from "../repositories/pocketbase"

const TTL_MS = 60_000

let cache: { data: Stats; at: number } | undefined

export const statsService = {
  async get(): Promise<Stats> {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return cache.data
    }
    const admin = await forSuperuser()
    // Single-row platform_stats view (constant id) — one query instead of
    // two perPage-1 metadata pokes. The view counts teams (alias `teams`);
    // the Stats contract key stays `groups` for the marketing-site shape.
    const { items } = await admin.collection("platform_stats").getList(1, 1)
    const row = items[0] as unknown as Record<string, number>
    const data: Stats = { users: row.users, groups: row.teams }
    cache = { data, at: Date.now() }
    return data
  },
}
