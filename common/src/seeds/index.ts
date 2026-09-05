// Typed loader for the platform seed dataset.
//
// Reads the reviewable JSON (`common/seeds/platform.json`) and normalizes it
// into store-shaped structures for the bff seeder: validates every cross
// reference (owner/member usernames, item→category, list→item, frequency
// values), defaults missing fields, and derives the deterministic avatar.
// The shared demo password is passed in by the caller (sourced from `.env` as
// `SEED_PASSWORD`, D9) so the committed dataset carries no credential-shaped
// strings. Pure + sync so the seeder and tests trivially share it.
//
// Imported via the `@remindit/common/seeds` subpath (never from the root
// export) — it is the one common module that knowingly imports JSON.

import { CATEGORY_FREQUENCIES, type Category, type CategoryFrequency, type CatalogItem } from "../models/types"
import rawPlatform from "../../seeds/platform.json"
import { initialsAvatar } from "./avatar"
import { hashId } from "./hash"

export { generateTeamHistory } from "./history"
export type { GenerateTeamHistoryOptions } from "./history"
export { hashId }

export interface SeedUserSpec {
  username: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: "user" | "admin"
  avatar: string
}

export interface SeedCategorySpec {
  name: string
  frequency: CategoryFrequency
}

export interface SeedItemSpec {
  name: string
  categoryName: string
}

export interface SeedHistorySpec {
  days: number
  seed: number
}

export interface SeedTeamSpec {
  name: string
  ownerUsername: string
  memberUsernames: string[]
  categories: SeedCategorySpec[]
  items: SeedItemSpec[]
  listItemNames: string[]
  history: SeedHistorySpec
}

export interface SeedPlatform {
  /** Shared password for every seeded user (dev/demo only — documented). */
  password: string
  users: SeedUserSpec[]
  teams: SeedTeamSpec[]
}

// --- raw JSON shapes (the file stays loose; validation happens below) -------

interface RawUser {
  username: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
}
interface RawCategorySpec {
  name: string
  frequency: string
}
interface RawItemSpec {
  name: string
  category: string
}
interface RawHistorySpec {
  days?: number
  seed?: number
}
interface RawTeam {
  name: string
  owner: string
  members?: string[]
  categories: RawCategorySpec[]
  items: RawItemSpec[]
  list?: string[]
  history?: RawHistorySpec
}
interface RawPlatform {
  users: RawUser[]
  teams: RawTeam[]
}

const FAIL = (message: string): never => {
  throw new Error(`[seed] ${message}`)
}

const VALID_FREQUENCIES = new Set<string>(CATEGORY_FREQUENCIES)
const USERNAME_RE = /^[a-zA-Z0-9_-]+$/

const DEFAULT_HISTORY: SeedHistorySpec = { days: 180, seed: 1 }

/**
 * Normalize the raw JSON into typed seed structures. Throws on any dangling
 * reference so a bad dataset fails loudly at seed time (and in tests) instead
 * of silently writing half a team.
 *
 * @param password the shared demo password assigned to every seeded user —
 *   caller-supplied (bff reads it from `SEED_PASSWORD`) so the committed
 *   dataset stays free of credential-shaped strings.
 */
export function loadPlatformSeed(password: string): SeedPlatform {
  const raw = rawPlatform as RawPlatform
  if (!password || password.length < 8) {
    FAIL(`dataset password must be ≥8 chars (got "${password}")`)
  }

  const usernames = new Set<string>()
  const users: SeedUserSpec[] = raw.users.map((u) => {
    if (!USERNAME_RE.test(u.username) || u.username.length < 2) {
      FAIL(`invalid username "${u.username}" (must match ${USERNAME_RE})`)
    }
    if (usernames.has(u.username)) {
      FAIL(`duplicate username "${u.username}"`)
    }
    usernames.add(u.username)
    const firstName = u.firstName ?? ""
    const lastName = u.lastName ?? ""
    return {
      username: u.username,
      email: u.email,
      password,
      firstName,
      lastName,
      role: u.role === "admin" ? "admin" : "user",
      avatar: initialsAvatar(firstName || u.username, lastName, u.username),
    }
  })

  const teams: SeedTeamSpec[] = raw.teams.map((t) => {
    const ownerUsername = t.owner
    if (!usernames.has(ownerUsername)) {
      FAIL(`team "${t.name}": unknown owner "${ownerUsername}"`)
    }
    const memberUsernames = [...new Set((t.members ?? []).filter((m) => m !== ownerUsername))]
    for (const m of memberUsernames) {
      if (!usernames.has(m)) FAIL(`team "${t.name}": unknown member "${m}"`)
    }

    const categories: SeedCategorySpec[] = t.categories.map((c) => {
      if (!VALID_FREQUENCIES.has(c.frequency)) {
        FAIL(`team "${t.name}": category "${c.name}" has invalid frequency "${c.frequency}"`)
      }
      return { name: c.name, frequency: c.frequency as CategoryFrequency }
    })
    const categoryNames = new Set(categories.map((c) => c.name))

    const items: SeedItemSpec[] = t.items.map((i) => {
      if (!categoryNames.has(i.category)) {
        FAIL(`team "${t.name}": item "${i.name}" references unknown category "${i.category}"`)
      }
      return { name: i.name, categoryName: i.category }
    })
    const itemNames = new Set(items.map((i) => i.name))

    const listItemNames = (t.list ?? []).map((name) => {
      if (!itemNames.has(name)) {
        FAIL(`team "${t.name}": list references unknown item "${name}"`)
      }
      return name
    })

    return {
      name: t.name,
      ownerUsername,
      memberUsernames,
      categories,
      items,
      listItemNames,
      history: { ...DEFAULT_HISTORY, ...(t.history ?? {}) },
    }
  })

  return { password, users, teams }
}

/**
 * Derive a team's LOCAL categories + catalog (store shape) using the pwa id
 * scheme (`cat::<name>` / `item::<category>::<name>`). Returning these is what
 * makes a pwa joining a seeded group reconcile with identical ids.
 */
export function teamLocalIds(team: Pick<SeedTeamSpec, "categories" | "items">): {
  categories: Category[]
  catalog: CatalogItem[]
} {
  const categories: Category[] = team.categories.map((c) => ({
    id: hashId(`cat::${c.name}`),
    name: c.name,
    frequency: c.frequency,
  }))
  const catalog: CatalogItem[] = team.items.map((i) => ({
    id: hashId(`item::${i.categoryName}::${i.name}`),
    name: i.name,
    categoryId: hashId(`cat::${i.categoryName}`),
  }))
  return { categories, catalog }
}