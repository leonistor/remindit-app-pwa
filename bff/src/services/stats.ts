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
    // perPage 1 — we only need totalItems from the page metadata.
    // (SDK 0.28 signature: getList(page, perPage, options).) PB collection
    // is `teams` (renamed from groups); the Stats contract key stays `groups`.
    const [users, groups] = await Promise.all([
      admin.collection("users").getList(1, 1),
      admin.collection("teams").getList(1, 1),
    ])
    const data: Stats = { users: users.totalItems, groups: groups.totalItems }
    cache = { data, at: Date.now() }
    return data
  },
}
