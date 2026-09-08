// Conversations repository — CRUD for the `conversations` collection.
//
// The collection stores persistent AI chat memory (Task A, phase 2): one row
// per authenticated user × thread. Messages are stored as a JSON blob (the
// full VoltAgent/UIMessage array) in the `messages` field. The StorageAdapter
// in `src/lib/voltagent-pocketbase-storage.ts` calls these functions.

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"

const col = (client: PocketBase) =>
  client.collection(COLLECTION_NAMES.conversations)

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export const findConversationByThread = async (
  client: PocketBase,
  userId: string,
  threadId: string
): Promise<Record<string, unknown> | null> => {
  try {
    return await col(client).getFirstListItem(
      client.filter("user = {:userId} && threadId = {:threadId}", {
        userId,
        threadId,
      })
    )
  } catch {
    return null
  }
}

export const listConversationsByUser = async (
  client: PocketBase,
  userId: string,
  opts?: { limit?: number; offset?: number; sort?: string }
): Promise<Record<string, unknown>[]> => {
  const result = await col(client).getList(opts?.limit ?? 50, opts?.offset ?? 1, {
    filter: client.filter("user = {:userId}", { userId }),
    sort: opts?.sort ?? "-updated",
  })
  return result.items
}

export const countConversationsByUser = async (
  client: PocketBase,
  userId: string
): Promise<number> => {
  const result = await col(client).getList(1, 1, {
    filter: client.filter("user = {:userId}", { userId }),
  })
  return result.totalItems
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export const createConversation = async (
  client: PocketBase,
  data: {
    user: string
    threadId: string
    messages?: unknown
    locale?: string
  }
): Promise<Record<string, unknown>> => {
  return await col(client).create({
    user: data.user,
    threadId: data.threadId,
    messages: data.messages ?? [],
    locale: data.locale ?? "",
  })
}

export const upsertConversationByThread = async (
  client: PocketBase,
  userId: string,
  threadId: string,
  patch: {
    messages?: unknown
    locale?: string
  }
): Promise<Record<string, unknown>> => {
  const existing = await findConversationByThread(client, userId, threadId)
  if (existing) {
    return await col(client).update(existing.id as string, patch)
  }
  return await createConversation(client, {
    user: userId,
    threadId,
    ...patch,
  })
}

export const updateConversation = async (
  client: PocketBase,
  id: string,
  patch: { messages?: unknown; locale?: string; title?: string }
): Promise<Record<string, unknown>> => {
  return await col(client).update(id, patch)
}

export const deleteConversation = async (
  client: PocketBase,
  id: string
): Promise<void> => {
  await col(client).delete(id)
}
