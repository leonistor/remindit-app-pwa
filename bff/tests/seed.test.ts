// Integration tests for the platform seeder (bff/src/seeds/seed.ts) — live PB
// required (skipped otherwise, like admin.integration.test.ts). Uses a small
// inline fixture instead of the full dataset so runs stay fast and disposable;
// the real dataset is verified by the `seed` CLI + manual smoke.
//
// Idempotency is the gate: re-running the same dataset must create nothing.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hashId, type SeedPlatform } from "@remindit/common/seeds"
import { env } from "../src/env"
import { forSuperuser } from "../src/repositories/pocketbase"
import { seedPlatform } from "../src/seeds/seed"

const pbUp = await fetch(`${env.pocketbaseUrl}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)
const describeIfPb = pbUp ? describe : describe.skip

const TEST_NOW = Date.parse("2026-09-01T00:00:00Z")
const OWNER = "seed-u1"
const MEMBER = "seed-u2"
const TEAM_NAME = "Seed Test Team"

const FIXTURE: SeedPlatform = {
  password: "remindit-seed",
  users: [
    {
      username: OWNER,
      email: `${OWNER}@example.local`,
      password: "remindit-seed",
      firstName: "Seed",
      lastName: "One",
      role: "user",
      avatar: "",
    },
    {
      username: MEMBER,
      email: `${MEMBER}@example.local`,
      password: "remindit-seed",
      firstName: "Seed",
      lastName: "Two",
      role: "user",
      avatar: "",
    },
  ],
  teams: [
    {
      name: TEAM_NAME,
      ownerUsername: OWNER,
      memberUsernames: [MEMBER],
      categories: [
        { name: "fridge", frequency: "weekly" },
        { name: "pantry", frequency: "monthly" },
      ],
      items: [
        { name: "Milk", categoryName: "fridge" },
        { name: "Bread", categoryName: "pantry" },
      ],
      listItemNames: ["Milk"],
      history: { days: 21, seed: 199 },
    },
  ],
}

describeIfPb("platform seeder (live)", () => {
  /** Bottom-up team cleanup — `items.category` is non-cascade, so team
   *  children must be gone before their category row. */
  const removeFixture = async (): Promise<void> => {
    const pb = await forSuperuser()
    const teams = await pb
      .collection("teams")
      .getFullList({ filter: pb.filter("name = {:n}", { n: TEAM_NAME }) })
    for (const team of teams) {
      for (const collection of [
        "list_entries",
        "history_events",
        "items",
        "categories",
        "team_members",
        "notifications",
      ]) {
        const rows = await pb
          .collection(collection)
          .getFullList({ filter: pb.filter("team = {:t}", { t: team.id }) })
        for (const row of rows) {
          await pb.collection(collection).delete(row.id).catch(() => {})
        }
      }
      await pb.collection("teams").delete(team.id).catch(() => {})
    }
    for (const username of [OWNER, MEMBER]) {
      const users = await pb
        .collection("users")
        .getFullList({ filter: pb.filter("username = {:u}", { u: username }) })
      for (const user of users) {
        await pb.collection("users").delete(user.id).catch(() => {})
      }
    }
  }

  const getTeamId = async (): Promise<string> => {
    const pb = await forSuperuser()
    const teams = await pb
      .collection("teams")
      .getFullList({ filter: pb.filter("name = {:n}", { n: TEAM_NAME }) })
    return teams[0]?.id as string
  }

  beforeAll(removeFixture)
  afterAll(removeFixture)

  test("first run creates users, team, content, history and notifications", async () => {
    const pb = await forSuperuser()
    const summary = await seedPlatform(pb, FIXTURE, { now: TEST_NOW })

    expect(summary.created.users.sort()).toEqual([OWNER, MEMBER])
    expect(summary.created.teams).toEqual([TEAM_NAME])
    expect(summary.created.members).toEqual([MEMBER])
    expect(summary.existing.users).toEqual([])
    expect(summary.existing.teams).toEqual([])
    expect(summary.content.categories).toBe(2)
    expect(summary.content.items).toBe(2)
    expect(summary.content.listEntries).toBe(1)
    expect(summary.content.historyEvents).toBeGreaterThan(0)
    expect(summary.notifications).toBe(1)

    const teamId = await getTeamId()
    expect(teamId).toBeTruthy()

    const members = await pb
      .collection("team_members")
      .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
    expect(members).toHaveLength(2)

    const categories = await pb
      .collection("categories")
      .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
    expect(categories).toHaveLength(3) // sentinel + 2 authored
    expect(
      categories.some(
        (c) => (c as unknown as { name: string }).name === "Uncategorized"
      )
    ).toBe(true)

    const items = await pb
      .collection("items")
      .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
    expect(items).toHaveLength(2)
    const milk = items.find((i) => (i as unknown as { name: string }).name === "Milk")
    // pwa-scheme local id — a pwa joining this team reconciles with identical ids
    expect((milk as unknown as { localId?: string }).localId).toBe(
      hashId("item::fridge::Milk")
    )

    const entries = await pb
      .collection("list_entries")
      .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
    expect(entries).toHaveLength(1)
    expect((entries[0] as unknown as { checked: boolean }).checked).toBe(false)

    const events = await pb
      .collection("history_events")
      .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
    expect(events).toHaveLength(summary.content.historyEvents)
    for (const event of events) {
      const timestamp = (event as unknown as { timestamp: number }).timestamp
      expect(Number.isInteger(timestamp)).toBe(true)
      expect(timestamp).toBeLessThanOrEqual(TEST_NOW)
    }

    const memberUser = await pb
      .collection("users")
      .getFullList({ filter: pb.filter("username = {:u}", { u: MEMBER }) })
    const notifications = await pb.collection("notifications").getFullList({
      filter: pb.filter("user = {:id}", { id: memberUser[0]?.id ?? "" }),
    })
    expect(notifications).toHaveLength(1)
    expect((notifications[0] as unknown as { type: string }).type).toBe("member.added")
  })

  test("second run creates nothing and leaves totals unchanged", async () => {
    const pb = await forSuperuser()
    const teamId = await getTeamId()
    const counts = async (): Promise<Record<string, number>> => {
      const result: Record<string, number> = {}
      for (const collection of [
        "categories",
        "items",
        "list_entries",
        "history_events",
      ]) {
        const rows = await pb
          .collection(collection)
          .getFullList({ filter: pb.filter("team = {:t}", { t: teamId }) })
        result[collection] = rows.length
      }
      return result
    }

    const before = await counts()
    const summary = await seedPlatform(pb, FIXTURE, { now: TEST_NOW })

    expect(summary.created.users).toEqual([])
    expect(summary.created.teams).toEqual([])
    expect(summary.created.members).toEqual([])
    expect(summary.existing.users.sort()).toEqual([OWNER, MEMBER])
    expect(summary.existing.teams).toEqual([TEAM_NAME])
    expect(summary.content.categories).toBe(0)
    expect(summary.content.items).toBe(0)
    expect(summary.content.listEntries).toBe(0)
    expect(summary.content.historyEvents).toBe(0)
    expect(summary.notifications).toBe(0)

    const after = await counts()
    expect(after).toEqual(before)
  })
})