// PocketBaseStorageAdapter (Task A, phase 2) — VoltAgent's StorageAdapter
// backed by the `conversations` collection. Exercised through VoltAgent's
// `Memory` wrapper (the same wiring `services/ai.ts` uses) against the
// in-memory PB stub in `helpers/` — no model, no HTTP.

import { Memory } from "@voltagent/core"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { PocketBaseStorageAdapter } from "../src/lib/voltagent-pocketbase-storage"
import {
  makeFakeConversationsStore,
  type FakeConversationsStore,
} from "./helpers/fake-conversations-pb"

const userMsg = (id: string, text: string) => ({
  id,
  role: "user" as const,
  parts: [{ type: "text" as const, text }],
})
const asstMsg = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text" as const, text }],
})

describe("PocketBaseStorageAdapter (stubbed PB)", () => {
  let store: FakeConversationsStore
  let memory: Memory
  let adapter: PocketBaseStorageAdapter

  beforeAll(() => {
    store = makeFakeConversationsStore()
    adapter = new PocketBaseStorageAdapter(store.client)
    memory = new Memory({ storage: adapter })
  })

  afterAll(() => {
    store.restore()
  })

  test("addMessage persists the message to a per-thread row", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "hi"), "u-alice", "t1")
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].user).toBe("u-alice")
    expect(store.rows[0].threadId).toBe("t1")
    expect((store.rows[0].messages as { id: string }[]).map((m) => m.id)).toEqual(["m1"])
  })

  test("a second addMessage appends to the same row (no duplicate)", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "hi"), "u-alice", "t1")
    await memory.addMessage(asstMsg("m2", "hello!"), "u-alice", "t1")
    expect(store.rows).toHaveLength(1)
    expect((store.rows[0].messages as { id: string }[]).map((m) => m.id)).toEqual([
      "m1",
      "m2",
    ])
  })

  test("addMessages appends a batch", async () => {
    store.reset()
    await memory.addMessages(
      [userMsg("m1", "a"), asstMsg("m2", "b")],
      "u-alice",
      "t1"
    )
    expect((store.rows[0].messages as { id: string }[]).map((m) => m.id)).toEqual([
      "m1",
      "m2",
    ])
  })

  test("getMessages returns the stored thread, scoped by user", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "hi"), "u-alice", "t1")
    await memory.addMessage(userMsg("m1", "hi"), "u-bob", "t1")
    const alice = await memory.getMessages("u-alice", "t1")
    expect(alice.map((m) => m.id)).toEqual(["m1"])
    expect(await memory.getMessages("u-other", "t1")).toEqual([])
  })

  test("getMessages applies role + limit options", async () => {
    store.reset()
    await memory.addMessages(
      [userMsg("m1", "a"), asstMsg("m2", "b"), userMsg("m3", "c")],
      "u-alice",
      "t1"
    )
    const users = await memory.getMessages("u-alice", "t1", { roles: ["user"] })
    expect(users.map((m) => m.id)).toEqual(["m1", "m3"])
    const lastTwo = await memory.getMessages("u-alice", "t1", { limit: 2 })
    expect(lastTwo.map((m) => m.id)).toEqual(["m2", "m3"])
  })

  test("deleteMessages removes only the listed ids", async () => {
    store.reset()
    await memory.addMessages(
      [userMsg("m1", "a"), asstMsg("m2", "b"), userMsg("m3", "c")],
      "u-alice",
      "t1"
    )
    await memory.deleteMessages(["m2"], "u-alice", "t1")
    expect((store.rows[0].messages as { id: string }[]).map((m) => m.id)).toEqual([
      "m1",
      "m3",
    ])
  })

  test("clearMessages(conversationId) empties just that thread", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    await memory.addMessage(userMsg("m2", "b"), "u-alice", "t2")
    await memory.clearMessages("u-alice", "t1")
    expect(store.rows[0].messages).toEqual([])
    expect(store.rows[1].messages).toHaveLength(1)
  })

  test("clearMessages() empties every thread for the user", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    await memory.addMessage(userMsg("m2", "b"), "u-alice", "t2")
    await memory.clearMessages("u-alice")
    expect(store.rows.every((r) => r.messages === undefined || r.messages === null || (r.messages as unknown[]).length === 0)).toBe(true)
  })

  test("createConversation maps userId + input id to the row", async () => {
    store.reset()
    const conv = await memory.createConversation({
      id: "t1",
      resourceId: "",
      userId: "u-alice",
      title: "Support thread",
      metadata: {},
    })
    // VoltAgent's conversation id IS the threadId (the client's stable id).
    expect(conv.id).toBe("t1")
    expect(store.rows[0].user).toBe("u-alice")
    expect(store.rows[0].threadId).toBe("t1")
  })

  test("getConversation resolves by threadId; a miss → null", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "hi"), "u-alice", "t1")
    const found = await memory.getConversation("t1")
    expect(found?.userId).toBe("u-alice")
    expect(found?.id).toBe("t1")
    expect(await memory.getConversation("missing")).toBeNull()
  })

  test("getConversationsByUserId lists + counts the user's threads", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    await memory.addMessage(userMsg("m2", "b"), "u-alice", "t2")
    await memory.addMessage(userMsg("m3", "c"), "u-bob", "b1")
    const convs = await memory.getConversationsByUserId("u-alice")
    expect(convs.map((c) => c.id)).toEqual(["t2", "t1"])
    expect(
      await memory.countConversations({ userId: "u-alice" })
    ).toBe(2)
  })

  test("updateConversation patches the title", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    const updated = await memory.updateConversation("t1", { title: "Renamed" })
    expect(updated.title).toBe("Renamed")
    expect(store.rows[0].title).toBe("Renamed")
  })

  test("deleteConversation removes the row", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    await memory.deleteConversation("t1")
    expect(store.rows).toHaveLength(0)
  })

  test("working-memory stubs are safe no-ops (no schema field)", async () => {
    store.reset()
    await memory.addMessage(userMsg("m1", "a"), "u-alice", "t1")
    // setWorkingMemory must not throw and must not write (no schema field).
    await adapter.setWorkingMemory({
      userId: "u-alice",
      conversationId: "t1",
      content: "remember: mustard",
      scope: "conversation",
    })
    expect(
      await adapter.getWorkingMemory({
        userId: "u-alice",
        conversationId: "t1",
        scope: "conversation",
      })
    ).toBeNull()
    // Memory wrapper: disabled config short-circuits to null.
    expect(
      await memory.getWorkingMemory({ userId: "u-alice", conversationId: "t1" })
    ).toBeNull()
  })
})