// Conversations repository (Task A, phase 2) — CRUD for the `conversations`
// collection against the in-memory PB stub in `helpers/`. The adapter in
// `src/lib/voltagent-pocketbase-storage.ts` builds on these functions; its own
// test lives in `voltagent-storage.test.ts`.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import {
  countConversationsByUser,
  createConversation,
  deleteConversation,
  findConversationByThread,
  listConversationsByUser,
  updateConversation,
  upsertConversationByThread,
} from "../src/repositories/conversations"
import {
  makeFakeConversationsStore,
  type FakeConversationsStore,
} from "./helpers/fake-conversations-pb"

const M1 = {
  id: "m1",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "hi" }],
}

describe("conversations repository (stubbed PB)", () => {
  let store: FakeConversationsStore

  beforeAll(() => {
    store = makeFakeConversationsStore()
  })

  afterAll(() => {
    store.restore()
  })

  test("create persists a row with the relation + defaults", async () => {
    store.reset()
    const row = await createConversation(store.client, {
      user: "u-alice",
      threadId: "t1",
      locale: "ro",
    })
    expect(row.id).toBe("conv-1")
    expect(row.user).toBe("u-alice")
    expect(row.threadId).toBe("t1")
    expect(row.locale).toBe("ro")
    // Messages default to an empty array, not null.
    expect(row.messages).toEqual([])
    expect(store.rows).toHaveLength(1)
  })

  test("findConversationByThread matches user + threadId", async () => {
    store.reset()
    await createConversation(store.client, { user: "u-alice", threadId: "t1" })
    const found = await findConversationByThread(store.client, "u-alice", "t1")
    expect(found).not.toBeNull()
    expect((found as { id: string }).id).toBe("conv-1")
  })

  test("findConversationByThread is user-scoped (same thread, other user → null)", async () => {
    store.reset()
    await createConversation(store.client, { user: "u-alice", threadId: "t1" })
    const found = await findConversationByThread(store.client, "u-bob", "t1")
    expect(found).toBeNull()
  })

  test("findConversationByThread returns null on a miss (no throw)", async () => {
    store.reset()
    const found = await findConversationByThread(store.client, "u-alice", "nope")
    expect(found).toBeNull()
  })

  test("listConversationsByUser returns only that user's rows", async () => {
    store.reset()
    await createConversation(store.client, { user: "u-alice", threadId: "t1" })
    await createConversation(store.client, { user: "u-bob", threadId: "b1" })
    await createConversation(store.client, { user: "u-alice", threadId: "t2" })
    const rows = await listConversationsByUser(store.client, "u-alice")
    expect(rows.map((r) => r.threadId)).toEqual(["t2", "t1"])
  })

  test("countConversationsByUser counts only that user's rows", async () => {
    store.reset()
    await createConversation(store.client, { user: "u-alice", threadId: "t1" })
    await createConversation(store.client, { user: "u-bob", threadId: "b1" })
    await createConversation(store.client, { user: "u-alice", threadId: "t2" })
    expect(await countConversationsByUser(store.client, "u-alice")).toBe(2)
    expect(await countConversationsByUser(store.client, "u-bob")).toBe(1)
  })

  test("updateConversation patches fields on the row", async () => {
    store.reset()
    const created = await createConversation(store.client, {
      user: "u-alice",
      threadId: "t1",
    })
    const updated = await updateConversation(store.client, created.id as string, {
      messages: [M1],
      locale: "de",
    })
    expect(updated.messages).toEqual([M1])
    expect(updated.locale).toBe("de")
    expect(store.rows[0].messages).toEqual([M1])
  })

  test("upsertConversationByThread creates on a miss and updates on a hit", async () => {
    store.reset()
    // Miss → create.
    const created = await upsertConversationByThread(store.client, "u-alice", "t1", {
      messages: [M1],
    })
    expect(created.id).toBe("conv-1")
    expect(store.rows).toHaveLength(1)
    // Hit → update the same row, no second row.
    const updated = await upsertConversationByThread(store.client, "u-alice", "t1", {
      messages: [M1, { ...M1, id: "m2" }],
    })
    expect(updated.id).toBe("conv-1")
    expect(store.rows).toHaveLength(1)
    expect((store.rows[0].messages as { id: string }[]).map((m) => m.id)).toEqual([
      "m1",
      "m2",
    ])
  })

  test("deleteConversation removes the row", async () => {
    store.reset()
    const created = await createConversation(store.client, {
      user: "u-alice",
      threadId: "t1",
    })
    await deleteConversation(store.client, created.id as string)
    expect(store.rows).toHaveLength(0)
    expect(await findConversationByThread(store.client, "u-alice", "t1")).toBeNull()
  })
})