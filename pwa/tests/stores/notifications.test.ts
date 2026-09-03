// Notifications store tests (D4): the in-app consumer over the BFF
// /api/notifications contract. `@/lib/bff-api` is mocked at the module
// boundary (same pattern as sync-engine.test.ts) — real nanostores, no
// network. The sign-out clear rides the module-wired $syncSession
// subscription in the store, exercised through the real sync/session store.

import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core"
import {
  $notifications,
  $unreadCount,
  markRead,
  refreshNotifications,
} from "@/stores/notifications"
import { setSession } from "@/stores/sync/session"
import { resetStores } from "../fixtures/reset"

const bffApi = rs.hoisted(() => ({
  listNotifications: rs.fn<() => Promise<unknown[]>>(),
  markNotificationRead: rs.fn<() => Promise<void>>(),
}))

// The mock replaces the whole module; the store only imports `bffApi`.
rs.mock("@/lib/bff-api", () => ({ bffApi }))

const SESSION = { token: "tok", userId: "u1", email: "leo@example.com" }

// Deliberately out of chronological order (n3 → n1 → n2) so the newest-first
// sort is observable; n3 carries an unknown type + null payload to exercise
// the loose-contract tolerance.
const ROWS: unknown[] = [
  {
    id: "n3",
    type: "weird.unknown",
    payload: null,
    read: false,
    created: "2026-08-28T09:00:00.000Z",
  },
  {
    id: "n1",
    type: "member.added",
    payload: { teamId: "g1", teamName: "Family", actorUsername: "maria" },
    read: false,
    created: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "n2",
    type: "member.left",
    payload: { teamName: "Family", actorUsername: "dan" },
    read: true,
    created: "2026-08-30T09:00:00.000Z",
  },
]

const readFlags = (): Array<{ id: string; read: boolean }> =>
  $notifications.get().map((item) => ({ id: item.id, read: item.read }))

const stubRows = (): void => {
  bffApi.listNotifications.mockImplementation(async () => ROWS)
}

beforeEach(() => {
  resetStores()
  setSession({ ...SESSION })
  for (const fn of Object.values(bffApi)) fn.mockReset()
})

afterEach(() => {
  // Fires the store's session-null subscription → list cleared.
  setSession(null)
  resetStores()
})

describe("notifications store", () => {
  test("refresh populates the list newest-first and computes unread", async () => {
    stubRows()
    await refreshNotifications()
    expect($notifications.get().map((item) => item.id)).toEqual([
      "n1",
      "n2",
      "n3",
    ])
    expect($unreadCount.get()).toBe(2)
  })

  test("markRead flips the row optimistically, then keeps it after the PATCH", async () => {
    stubRows()
    await refreshNotifications()
    let resolvePatch!: () => void
    bffApi.markNotificationRead.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve
        })
    )
    const done = markRead("n1")
    // Optimistic: read locally before the PATCH resolves.
    expect(readFlags().find((row) => row.id === "n1")?.read).toBe(true)
    resolvePatch()
    await done
    expect(bffApi.markNotificationRead).toHaveBeenCalledWith("tok", "n1")
    expect($unreadCount.get()).toBe(1)
  })

  test("markRead reverts to the exact previous list on error", async () => {
    stubRows()
    await refreshNotifications()
    const before = readFlags()
    bffApi.markNotificationRead.mockImplementation(async () => {
      throw new Error("boom")
    })
    await markRead("n1")
    expect(readFlags()).toEqual(before)
    expect($unreadCount.get()).toBe(2)
  })

  test("signed out: refresh and markRead are silent no-ops", async () => {
    setSession(null)
    await refreshNotifications()
    await markRead("n1")
    expect(bffApi.listNotifications).not.toHaveBeenCalled()
    expect(bffApi.markNotificationRead).not.toHaveBeenCalled()
    expect($notifications.get()).toEqual([])
  })

  test("a BffError keeps the old list", async () => {
    stubRows()
    await refreshNotifications()
    const before = readFlags()
    bffApi.listNotifications.mockImplementation(async () => {
      throw Object.assign(new Error("boom"), { name: "BffError", status: 500 })
    })
    await refreshNotifications()
    expect(readFlags()).toEqual(before)
  })

  test("a null session clears the list (sign-out)", async () => {
    stubRows()
    await refreshNotifications()
    expect($notifications.get()).toHaveLength(3)
    setSession(null)
    expect($notifications.get()).toEqual([])
    expect($unreadCount.get()).toBe(0)
  })
})
