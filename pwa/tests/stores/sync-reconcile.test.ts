// Reconcile diff unit tests (pure — no network, no PB): these pin the
// journal + three-way semantics documented in docs/SYNC.md.

import { describe, expect, test } from "@rstest/core"
import { diffCollection } from "@/stores/sync/reconcile"

type Rec = { id: string; name: string }

const spec = (overrides: {
  local?: Rec[]
  remote?: Array<Record<string, unknown>>
  map?: Record<string, string>
  journal?: Record<string, string>
  tombstones?: string[]
}) => ({
  local: overrides.local ?? [],
  remote: overrides.remote ?? [],
  map: overrides.map ?? {},
  journal: overrides.journal ?? {},
  tombstones: overrides.tombstones ?? [],
  toPayload: (local: Rec) => ({ name: local.name }),
  matches: (local: Rec, remote: Record<string, unknown>) =>
    remote.name === local.name,
})

describe("diffCollection", () => {
  test("local-only record → remoteCreate", () => {
    const result = diffCollection(
      spec({ local: [{ id: "a", name: "Milk" }] })
    )
    expect(result.actions).toEqual([
      { kind: "remoteCreate", localId: "a", payload: { name: "Milk" } },
    ])
  })

  test("first diff of a matching record heals (journal starts empty)", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Milk",
          },
        ],
        map: { a: "pb1" },
      })
    )
    expect(result.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-01-01T00:00:00Z" },
    ])
    expect(result.journal.pb1).toBe("2026-01-01T00:00:00Z")
  })

  test("matching local+remote with a current journal → no actions", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Milk",
          },
        ],
        map: { a: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
      })
    )
    expect(result.actions).toEqual([])
    expect(result.journal.pb1).toBe("2026-01-01T00:00:00Z")
  })

  test("re-diff of an unchanged state emits nothing at all", () => {
    const local = [{ id: "a", name: "Milk" }]
    const remote = [
      { id: "pb1", localId: "a", updated: "2026-01-01T00:00:00Z", name: "Milk" },
    ]
    const first = diffCollection(
      spec({ local, remote, map: { a: "pb1" } })
    )
    expect(first.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-01-01T00:00:00Z" },
    ])

    const second = diffCollection(
      spec({ local, remote, map: first.map, journal: first.journal })
    )
    expect(second.actions).toEqual([])
    expect(second.journal).toEqual(first.journal)
  })

  test("a newer remote stamp heals again (content unchanged)", () => {
    const local = [{ id: "a", name: "Milk" }]
    const first = diffCollection(
      spec({
        local,
        remote: [
          { id: "pb1", localId: "a", updated: "2026-01-01T00:00:00Z", name: "Milk" },
        ],
        map: { a: "pb1" },
      })
    )
    expect(first.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-01-01T00:00:00Z" },
    ])

    const second = diffCollection(
      spec({
        local,
        remote: [
          { id: "pb1", localId: "a", updated: "2026-02-01T00:00:00Z", name: "Milk" },
        ],
        map: first.map,
        journal: first.journal,
      })
    )
    expect(second.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-02-01T00:00:00Z" },
    ])
    expect(second.journal.pb1).toBe("2026-02-01T00:00:00Z")
  })

  test("remote changed since journal → localApply (remote wins)", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-02-01T00:00:00Z",
            name: "Oat milk",
          },
        ],
        map: { a: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
      })
    )
    expect(result.actions[0]).toMatchObject({
      kind: "localApply",
      pbId: "pb1",
      localId: "a",
    })
  })

  test("remote unchanged, content differs → remotePatch (local wins)", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Oat milk",
          },
        ],
        map: { a: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
      })
    )
    expect(result.actions[0]).toMatchObject({
      kind: "remotePatch",
      pbId: "pb1",
      localId: "a",
      payload: { name: "Milk" },
    })
  })

  test("both changed → LWW: newer remote beats the local edit", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk (local edit)" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-03-01T00:00:00Z",
            name: "Milk (remote edit)",
          },
        ],
        map: { a: "pb1" },
        journal: { pb1: "2026-02-01T00:00:00Z" },
      })
    )
    expect(result.actions[0]?.kind).toBe("localApply")
  })

  test("never-synced + differing content → remote wins (LWW baseline)", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Remote",
          },
        ],
      })
    )
    // Map recovery via localId happens first, then the LWW check with an
    // empty journal → remote wins.
    expect(result.actions[0]?.kind).toBe("localApply")
    expect(result.map.a).toBe("pb1")
  })

  test("remote-only record → localAdopt with map + journal updates", () => {
    const result = diffCollection(
      spec({
        remote: [
          {
            id: "pb9",
            localId: "from-other-device",
            updated: "2026-01-01T00:00:00Z",
            name: "Bread",
          },
        ],
      })
    )
    expect(result.actions[0]).toMatchObject({
      kind: "localAdopt",
      pbId: "pb9",
      localId: "from-other-device",
    })
    expect(result.map["from-other-device"]).toBe("pb9")
  })

  test("tombstoned record → remoteDelete, map + journal pruned", () => {
    const result = diffCollection(
      spec({
        remote: [
          {
            id: "pb1",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Milk",
          },
        ],
        map: { a: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
        tombstones: ["a"],
      })
    )
    expect(result.actions).toEqual([
      { kind: "remoteDelete", pbId: "pb1", localId: "a" },
    ])
    expect(result.map.a).toBeUndefined()
    expect(result.journal.pb1).toBeUndefined()
  })

  test("tombstone for a record already gone remotely just expires", () => {
    const result = diffCollection(
      spec({ map: { a: "pb1" }, journal: { pb1: "x" }, tombstones: ["a"] })
    )
    expect(result.actions).toEqual([])
    expect(result.tombstones).toEqual([])
  })

  test("pb record vanished (deleted elsewhere) → localDelete", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        map: { a: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
      })
    )
    expect(result.actions).toEqual([
      { kind: "localDelete", pbId: "pb1", localId: "a" },
    ])
    expect(result.map.a).toBeUndefined()
    expect(result.journal.pb1).toBeUndefined()
  })

  test("create-only (history): existence wins — no patches, no deletes", () => {
    const result = diffCollection({
      ...spec({
        local: [{ id: "h1", name: "x" }],
        remote: [
          {
            id: "pb1",
            localId: "h1",
            updated: "2026-01-01T00:00:00Z",
            name: "different",
          },
        ],
        map: { h1: "pb1" },
        journal: { pb1: "2025-12-01T00:00:00Z" },
        tombstones: ["h1"],
      }),
      matches: () => false,
      createOnly: true,
    })
    expect(result.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-01-01T00:00:00Z" },
    ])
    expect(result.tombstones).toEqual([])
  })

  test("create-only: an already-journaled event re-diffs to no actions", () => {
    const result = diffCollection({
      ...spec({
        local: [{ id: "h1", name: "x" }],
        remote: [
          {
            id: "pb1",
            localId: "h1",
            updated: "2026-01-01T00:00:00Z",
            name: "different",
          },
        ],
        map: { h1: "pb1" },
        journal: { pb1: "2026-01-01T00:00:00Z" },
      }),
      matches: () => false,
      createOnly: true,
    })
    expect(result.actions).toEqual([])
  })

  test("create-only: a newer remote stamp heals again", () => {
    const local = [{ id: "h1", name: "x" }]
    const first = diffCollection({
      ...spec({
        local,
        remote: [
          {
            id: "pb1",
            localId: "h1",
            updated: "2026-01-01T00:00:00Z",
            name: "different",
          },
        ],
        map: { h1: "pb1" },
      }),
      matches: () => false,
      createOnly: true,
    })
    expect(first.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-01-01T00:00:00Z" },
    ])

    const second = diffCollection({
      ...spec({
        local,
        remote: [
          {
            id: "pb1",
            localId: "h1",
            updated: "2026-02-01T00:00:00Z",
            name: "different",
          },
        ],
        map: first.map,
        journal: first.journal,
      }),
      matches: () => false,
      createOnly: true,
    })
    expect(second.actions).toEqual([
      { kind: "heal", pbId: "pb1", updated: "2026-02-01T00:00:00Z" },
    ])
  })

  test("create-only: remote-only events are adopted despite mismatch", () => {
    const result = diffCollection({
      ...spec({
        remote: [
          {
            id: "pb2",
            localId: "h2",
            updated: "2026-01-01T00:00:00Z",
            name: "elsewhere",
          },
        ],
      }),
      matches: () => false,
      createOnly: true,
    })
    expect(result.actions).toEqual([
      { kind: "localAdopt", pbId: "pb2", localId: "h2", remote: expect.anything() },
    ])
  })

  test("map recovery: unmapped remote record carrying our localId is claimed", () => {
    const result = diffCollection(
      spec({
        local: [{ id: "a", name: "Milk" }],
        remote: [
          {
            id: "pb7",
            localId: "a",
            updated: "2026-01-01T00:00:00Z",
            name: "Milk",
          },
        ],
      })
    )
    expect(result.map.a).toBe("pb7")
    expect(result.actions[0]?.kind).toBe("heal")
  })
})
