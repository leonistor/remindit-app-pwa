// Engine tests with a stubbed PB/BFF client (real nanostores, no network):
// covers engine-level behaviors the pure diff tests can't — journal stamping
// on remote-win applies (H1), connect serialization (H3), the store-trigger
// gating (history_events excluded from store-change reconciles) and the
// lastSeenIds reset on sign-out.
//
// Both network boundaries are mocked at the module boundary (rstest
// `rs.mock`, same pattern as the snapdom/profile-generator mocks): the
// `pocketbase` SDK is replaced by an in-memory record store whose `updated`
// stamps advance monotonically, and `@/lib/bff-api` by rs.fn stubs. The sync
// stores ($session/group/map/journal) live inside the engine, so each test
// resets them through the public `signOut()`.

import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core"
import { $catalog } from "@/stores/catalog"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { STORAGE_KEYS } from "@/stores/persistence"
import { $syncState, reconcileAll, signIn, signOut } from "@/stores/sync/engine"
import type { HistoryEvent } from "@/stores/types"
import { resetStores } from "../fixtures/reset"

const EMAIL = "leo@example.com"
// Fixed record timestamps for seeded remote state; the fake server's own
// stamps live in 2099 so lexicographic LWW stays monotonic against them.
const T1 = "2026-01-01T00:00:00Z"
const T2 = "2026-01-02T00:00:00Z"

// Real timers: the engine's store-trigger debounce is 500ms and the profile
// push (scheduled by the $user listener's immediate subscribe callback on the
// suite's first connect) is 1000ms — waits of 1200ms flush any pending
// reconcile before a no-change window, 700ms flush one we expect to run.
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const readTombstones = (collection: string): string[] => {
  const raw = localStorage.getItem(STORAGE_KEYS.syncTombstones)
  const parsed = raw === null ? {} : JSON.parse(raw)
  return (parsed as Record<string, string[]>)[collection] ?? []
}

const pbState = rs.hoisted(() => {
  type Rec = {
    id: string
    localId?: string
    updated?: string
    [key: string]: unknown
  }
  const remote: Record<string, Rec[]> = {
    categories: [],
    items: [],
    list_entries: [],
    history_events: [],
    users: [],
  }
  const calls = {
    creates: [] as Array<{
      collection: string
      payload: Record<string, unknown>
    }>,
    updates: [] as Array<{
      collection: string
      id: string
      payload: Record<string, unknown>
    }>,
    deletes: [] as Array<{ collection: string; id: string }>,
    // One entry per getFullList — a full reconcile pass fetches all four
    // collections, so this doubles as a "did a reconcile run" probe.
    lists: [] as string[],
    groupsCreated: 0,
  }
  let seq = 0
  const stamp = () => `2099-01-01T00:00:00.${String(++seq).padStart(6, "0")}Z`

  const collection = (name: string) => ({
    getFullList: async () => {
      calls.lists.push(name)
      return [...(remote[name] ?? [])]
    },
    getOne: async (id: string) => {
      const record = (remote[name] ?? []).find((r) => r.id === id)
      if (!record) throw new Error(`404: ${name}/${id}`)
      return record
    },
    create: async (payload: Record<string, unknown>) => {
      const record: Rec = {
        id: `pb-${name}-${++seq}`,
        updated: stamp(),
        ...payload,
      }
      remote[name]?.push(record)
      calls.creates.push({ collection: name, payload })
      return record
    },
    update: async (id: string, payload: Record<string, unknown>) => {
      const record = (remote[name] ?? []).find((r) => r.id === id)
      if (!record) throw new Error(`404: ${name}/${id}`)
      Object.assign(record, payload, { updated: stamp() })
      calls.updates.push({ collection: name, id, payload })
      return record
    },
    delete: async (id: string) => {
      const list = remote[name]
      if (list) remote[name] = list.filter((r) => r.id !== id)
      calls.deletes.push({ collection: name, id })
    },
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  })

  class FakePocketBase {
    authStore = {
      save: () => undefined,
      clear: () => undefined,
    }
    autoCancellation(): void {}
    filter(): string {
      return ""
    }
    collection(name: string) {
      return collection(name)
    }
  }

  const reset = () => {
    for (const key of Object.keys(remote)) remote[key] = []
    calls.creates.length = 0
    calls.updates.length = 0
    calls.deletes.length = 0
    calls.lists.length = 0
    calls.groupsCreated = 0
    seq = 0
  }

  return { remote, calls, reset, FakePocketBase }
})

rs.mock("pocketbase", () => ({ default: pbState.FakePocketBase }))

const bffApi = rs.hoisted(() => {
  type Auth = { token: string; user: { id: string; email: string } }
  return {
    register: rs.fn<() => Promise<Auth>>(),
    login: rs.fn<() => Promise<Auth>>(),
    me: rs.fn<() => Promise<{ email: string }>>(),
    createGroup: rs.fn<() => Promise<{ id: string }>>(),
    listGroups: rs.fn<() => Promise<Array<{ id: string; name: string }>>>(),
    listNotifications: rs.fn<() => Promise<unknown[]>>(),
  }
})

rs.mock("@/lib/bff-api", () => ({ bffApi }))

// Stubs the auth RPCs for an existing group (no group creation).
function stubAuth(existingGroups: Array<{ id: string; name: string }>): void {
  bffApi.login.mockImplementation(async () => ({
    token: "tok",
    user: { id: "u1", email: EMAIL },
  }))
  bffApi.me.mockImplementation(async () => ({ email: EMAIL }))
  bffApi.listGroups.mockImplementation(async () => existingGroups)
  bffApi.createGroup.mockImplementation(async () => {
    pbState.calls.groupsCreated += 1
    return { id: "g-created" }
  })
}

beforeEach(async () => {
  // signOut clears the engine-internal session/map/journal/tombstones; the
  // store listeners it leaves behind no-op without a session.
  await signOut()
  resetStores()
  pbState.reset()
  for (const fn of Object.values(bffApi)) fn.mockReset()
})

afterEach(async () => {
  await signOut()
})

describe("sync engine (stubbed clients)", () => {
  test("a local edit after a remote-win apply survives the next reconcile", async () => {
    stubAuth([{ id: "g1", name: "My list" }])
    pbState.remote.items = [
      {
        id: "pb-i1",
        localId: "t1-item",
        updated: T1,
        name: "Milk",
        group: "g1",
      },
    ]

    await signIn(EMAIL, "pw")
    expect($catalog.get().map((item) => item.name)).toEqual(["Milk"])

    // Another device edits the record: remote `updated` moves past the
    // journal → remote wins, the local copy is overwritten.
    pbState.remote.items[0] = {
      ...pbState.remote.items[0],
      updated: T2,
      name: "Oat milk",
    }
    await reconcileAll()
    expect($catalog.get().map((item) => item.name)).toEqual(["Oat milk"])

    // The user edits the adopted record locally.
    const [adopted] = $catalog.get()
    $catalog.set([{ ...adopted, name: "Oat milk (local edit)" }])

    // The journal was stamped at the remote-win apply, so the edit — not the
    // stale remote copy — is pushed as a remotePatch.
    await reconcileAll()
    expect(pbState.calls.updates).toHaveLength(1)
    expect(pbState.calls.updates[0]?.collection).toBe("items")
    expect(pbState.calls.updates[0]?.id).toBe("pb-i1")
    expect(pbState.calls.updates[0]?.payload.name).toBe("Oat milk (local edit)")
    expect($catalog.get().map((item) => item.name)).toEqual([
      "Oat milk (local edit)",
    ])
    expect(pbState.remote.items[0]?.name).toBe("Oat milk (local edit)")
  })

  test("concurrent connects create the group exactly once", async () => {
    bffApi.login.mockImplementation(async () => ({
      token: "tok",
      user: { id: "u2", email: EMAIL },
    }))
    bffApi.me.mockImplementation(async () => ({ email: EMAIL }))
    bffApi.listGroups.mockImplementation(async () => [])
    bffApi.createGroup.mockImplementation(async () => {
      pbState.calls.groupsCreated += 1
      return { id: "g-new" }
    })

    // e.g. sign-in racing an `online` event: the second connect must reuse
    // the in-flight one instead of running its own ensureGroup.
    await Promise.all([signIn(EMAIL, "pw"), signIn(EMAIL, "pw")])

    expect(pbState.calls.groupsCreated).toBe(1)
    expect($syncState.get().groupId).toBe("g-new")
  })

  test("history store changes schedule no reconcile; other stores still do", async () => {
    stubAuth([{ id: "g1", name: "My list" }])
    await signIn(EMAIL, "pw")
    // Flush reconcile timers possibly left over from earlier tests (the
    // 500ms store debounce from a previous sign-in, the 1000ms profile push
    // scheduled by the suite's first connect) before judging this test's own
    // no-change window.
    await wait(1200)
    pbState.calls.lists.length = 0

    // History is append-only and watched by nothing: a local-only change
    // must not schedule a reconcile (remote history arrives via the realtime
    // subscription; local pushes go through the foreground/heartbeat
    // triggers).
    const event: HistoryEvent = {
      id: "h1",
      action: "add",
      itemId: "i1",
      itemName: "Milk",
      categoryId: "uncategorized",
      categoryName: "Uncategorized",
      timestamp: 1,
    }
    $history.set([...$history.get(), event])
    await wait(700)
    expect(pbState.calls.lists).toEqual([])

    // Sanity: the other collections still reconcile on store change.
    $list.set([
      { id: "e1", itemId: "i1", checked: false, addedAt: 1 },
    ])
    await wait(700)
    expect(pbState.calls.lists.length).toBeGreaterThan(0)
  })

  test("signOut resets the id snapshots: the next session tracks fresh (no false tombstones)", async () => {
    stubAuth([{ id: "g1", name: "My list" }])
    await signIn(EMAIL, "pw")

    // Session 1: A and B land in the engine's lastSeenIds snapshot.
    $list.set([
      { id: "A", itemId: "i1", checked: false, addedAt: 1 },
      { id: "B", itemId: "i2", checked: false, addedAt: 2 },
    ])
    await signOut()

    // Session 2 introduces ids C/D. lastSeenIds was cleared at sign-out, so
    // the C/D snapshot is fresh — the stale A/B ids must not resurface as
    // tombstones (that would delete-live A/B records on the next reconcile).
    await signIn(EMAIL, "pw")
    $list.set([
      { id: "C", itemId: "i1", checked: false, addedAt: 3 },
      { id: "D", itemId: "i2", checked: false, addedAt: 4 },
    ])
    expect(readTombstones("list_entries")).toEqual([])

    // And the debounced reconcile that the C/D change schedules must not
    // manufacture tombstones either.
    await wait(700)
    expect(readTombstones("list_entries")).toEqual([])
  })
})
