// Test helper — in-memory PocketBase `conversations` collection stub.
//
// Mirrors the groups/feedback test convention: a real PocketBase client is
// used (so `client.filter()` interpolation is real) but `collection()` is
// swapped for an in-memory store so no HTTP happens. Rows are shared via a
// mutable `rows` array so tests can assert on what was persisted.
//
// The filter evaluator handles the equality conjuncts this codebase emits
// (`user = "..." && threadId = "..."`), which is all the repo/adapter use.

import { spyOn } from "bun:test"
import PocketBase, { ClientResponseError } from "pocketbase"
import { COLLECTION_NAMES } from "../../src/schema/collections"

export type ConvRow = {
  id: string
  user: string
  threadId: string
  messages: unknown
  locale?: string
  created: string
  updated: string
  [key: string]: unknown
}

export type FakeConversationsStore = {
  client: PocketBase
  /** Rows in insertion order — tests assert on persistence via this. */
  rows: ConvRow[]
  /** Clears the store between tests (keeps the one-time spy in place). */
  reset: () => void
  restore: () => void
}

export const makeFakeConversationsStore = (): FakeConversationsStore => {
  const rows: ConvRow[] = []
  let seq = 0
  let tick = 0

  // Monotonic timestamps so `-updated` sorts are deterministic and orderable.
  const stamp = (): string => {
    tick += 1
    return `2026-09-08 10:00:00.${String(tick).padStart(3, "0")}Z`
  }

  const rowOrThrow = (id: string): ConvRow => {
    const found = rows.find((r) => r.id === id)
    if (!found) {
      throw new ClientResponseError({ status: 404, response: { code: 404 } })
    }
    return found
  }

  // `client.filter()` already interpolated `{:param}` placeholders, so the
  // filter string is concrete equality conjuncts we can evaluate.
  const matches = (filter: string, r: ConvRow): boolean =>
    filter.split(" && ").every((part) => {
      const [lhs, rhs] = part.split(" = ")
      return JSON.stringify(r[lhs]) === rhs
    })

  const sortRows = (src: ConvRow[], sort?: string): ConvRow[] => {
    if (!sort) return [...src]
    const desc = sort.startsWith("-")
    const field = desc ? sort.slice(1) : sort
    return [...src].sort((a, b) => {
      const av = String(a[field] ?? "")
      const bv = String(b[field] ?? "")
      return desc ? bv.localeCompare(av) : av.localeCompare(bv)
    })
  }

  const collection = {
    create: async (data: Record<string, unknown>) => {
      seq += 1
      const r: ConvRow = {
        ...(data as ConvRow),
        id: `conv-${seq}`,
        created: stamp(),
        updated: stamp(),
      }
      rows.push(r)
      return { ...r }
    },
    update: async (id: string, patch: Record<string, unknown>) => {
      const r = rowOrThrow(id)
      Object.assign(r, patch, { updated: stamp() })
      return { ...r }
    },
    delete: async (id: string) => {
      const idx = rows.findIndex((r) => r.id === id)
      if (idx < 0) {
        throw new ClientResponseError({ status: 404, response: { code: 404 } })
      }
      rows.splice(idx, 1)
      return true
    },
    getOne: async (id: string) => rowOrThrow(id),
    getFirstListItem: async (filter: string) => {
      const found = rows.find((r) => matches(filter, r))
      if (!found) {
        throw new ClientResponseError({ status: 404, response: { code: 404 } })
      }
      return { ...found }
    },
    getList: async (
      page = 1,
      perPage = 50,
      opts?: { filter?: string; sort?: string }
    ) => {
      const filter = opts?.filter
      const filtered = filter ? rows.filter((r) => matches(filter, r)) : [...rows]
      const sorted = sortRows(filtered, opts?.sort)
      return {
        page,
        perPage,
        totalItems: sorted.length,
        totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
        items: sorted.slice((page - 1) * perPage, page * perPage).map((r) => ({ ...r })),
      }
    },
  }

  const client = new PocketBase("http://fake.invalid")
  const spy = spyOn(PocketBase.prototype, "collection")
  spy.mockImplementation(function (this: PocketBase, name: string) {
    if (name === COLLECTION_NAMES.conversations) return collection as never
    throw new ClientResponseError({
      status: 404,
      response: { code: 404, message: `unexpected collection ${name}` },
    })
  } as never)

  return {
    client,
    rows,
    reset: () => {
      rows.splice(0, rows.length)
      seq = 0
      tick = 0
    },
    restore: () => spy.mockRestore(),
  }
}