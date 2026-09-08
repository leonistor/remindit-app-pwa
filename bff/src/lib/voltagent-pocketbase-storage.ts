// PocketBacked StorageAdapter for VoltAgent — replaces the default
// InMemoryStorageAdapter with persistent PB storage (Task A, phase 2).
//
// Only authenticated users get persistence: the adapter is constructed with a
// PB client scoped to the caller's token (via `forToken`). Anonymous callers
// fall back to the default in-memory adapter (handled in `services/ai.ts`).
//
// Messages are stored as a JSON blob in the `messages` field of the
// `conversations` collection. This is simple, atomic, and sufficient for a
// single-thread support chat. The trade-off is that concurrent writes to the
// same conversation would race — acceptable for a 1:1 user:thread model.

import type {
  StorageAdapter,
  Conversation,
  ConversationQueryOptions,
  CreateConversationInput,
  GetMessagesOptions,
  OperationContext,
  WorkingMemoryScope,
  ConversationStepRecord,
  GetConversationStepsOptions,
  WorkflowStateEntry,
  WorkflowRunQuery,
} from "@voltagent/core"
import type { UIMessage } from "ai"
import type PocketBase from "pocketbase"
import {
  findConversationByThread,
  listConversationsByUser,
  countConversationsByUser,
  createConversation,
  updateConversation,
  deleteConversation,
} from "../repositories/conversations"

/** VoltAgent's conversation type (subset we store). */
type StoredConversation = Conversation

export class PocketBaseStorageAdapter implements StorageAdapter {
  constructor(private readonly client: PocketBase) {}

  // ── messages ──────────────────────────────────────────────────────────────

  async addMessage(
    message: UIMessage,
    userId: string,
    conversationId: string,
    _context?: OperationContext
  ): Promise<void> {
    const conv = await this.findConv(userId, conversationId)
    const messages: UIMessage[] = conv
      ? ((conv.messages as UIMessage[]) ?? [])
      : []
    messages.push(message)
    await this.saveMessages(userId, conversationId, messages)
  }

  async addMessages(
    newMessages: UIMessage[],
    userId: string,
    conversationId: string,
    _context?: OperationContext
  ): Promise<void> {
    const conv = await this.findConv(userId, conversationId)
    const messages: UIMessage[] = conv
      ? ((conv.messages as UIMessage[]) ?? [])
      : []
    messages.push(...newMessages)
    await this.saveMessages(userId, conversationId, messages)
  }

  async getMessages(
    userId: string,
    conversationId: string,
    options?: GetMessagesOptions,
    _context?: OperationContext
  ): Promise<UIMessage<{ createdAt: Date }>[]> {
    const conv = await this.findConv(userId, conversationId)
    if (!conv) return []

    let messages = ((conv.messages as UIMessage<{ createdAt: Date }>[]) ?? []) as UIMessage<{
      createdAt: Date
    }>[]

    // Apply options filtering (limit, roles).
    if (options?.roles?.length) {
      messages = messages.filter((m) =>
        options?.roles?.includes(m.role)
      )
    }
    if (options?.limit) {
      messages = messages.slice(-options.limit)
    }

    return messages
  }

  async clearMessages(
    userId: string,
    conversationId?: string,
    _context?: OperationContext
  ): Promise<void> {
    if (conversationId) {
      await this.saveMessages(userId, conversationId, [])
    } else {
      // Clear all conversations for this user.
      const convs = await listConversationsByUser(this.client, userId, {
        limit: 100,
      })
      for (const conv of convs) {
        await updateConversation(this.client, conv.id as string, {
          messages: [],
        })
      }
    }
  }

  async deleteMessages(
    messageIds: string[],
    userId: string,
    conversationId: string,
    _context?: OperationContext
  ): Promise<void> {
    const conv = await this.findConv(userId, conversationId)
    if (!conv) return
    const messages = ((conv.messages as UIMessage[]) ?? []).filter(
      (m) => !messageIds.includes(m.id)
    )
    await this.saveMessages(userId, conversationId, messages)
  }

  // ── conversations ─────────────────────────────────────────────────────────

  async createConversation(input: CreateConversationInput): Promise<StoredConversation> {
    const record = await createConversation(this.client, {
      user: input.userId,
      threadId: input.id,
      messages: [],
    })
    return {
      id: record.id as string,
      resourceId: input.resourceId,
      userId: input.userId,
      title: input.title,
      metadata: input.metadata,
      createdAt: (record.created as string) ?? new Date().toISOString(),
      updatedAt: (record.updated as string) ?? new Date().toISOString(),
    }
  }

  async getConversation(id: string): Promise<StoredConversation | null> {
    try {
      const record = await this.client
        .collection("conversations")
        .getOne(id)
      return {
        id: record.id,
        resourceId: "",
        userId: record.user as string,
        title: (record.title as string) ?? "",
        metadata: {},
        createdAt: record.created as string,
        updatedAt: record.updated as string,
      }
    } catch {
      return null
    }
  }

  async getConversations(_resourceId: string): Promise<StoredConversation[]> {
    // This method is called without a userId — return empty for now.
    // VoltAgent primarily uses getConversationsByUserId.
    return []
  }

  async getConversationsByUserId(
    userId: string,
    options?: Omit<ConversationQueryOptions, "userId">
  ): Promise<StoredConversation[]> {
    const records = await listConversationsByUser(this.client, userId, {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      sort:
        options?.orderBy === "title"
          ? options.orderDirection === "ASC"
            ? "title"
            : "-title"
          : options?.orderDirection === "ASC"
            ? "created"
            : "-updated",
    })
    return records.map((r) => ({
      id: r.id as string,
      resourceId: "",
      userId,
      title: (r.title as string) ?? "",
      metadata: {},
      createdAt: r.created as string,
      updatedAt: r.updated as string,
    }))
  }

  async queryConversations(
    options: ConversationQueryOptions
  ): Promise<StoredConversation[]> {
    const userId = options.userId
    if (!userId) return []
    return this.getConversationsByUserId(userId, options)
  }

  async countConversations(options: ConversationQueryOptions): Promise<number> {
    if (!options.userId) return 0
    return countConversationsByUser(this.client, options.userId)
  }

  async updateConversation(
    id: string,
    updates: Partial<Omit<StoredConversation, "id" | "createdAt" | "updatedAt">>
  ): Promise<StoredConversation> {
    const patch: { title?: string; messages?: unknown } = {}
    if (updates.title !== undefined) patch.title = updates.title
    const record = await updateConversation(this.client, id, patch)
    return {
      id: record.id as string,
      resourceId: (record.resourceId as string) ?? "",
      userId: (record.user as string) ?? "",
      title: (record.title as string) ?? "",
      metadata: updates.metadata ?? {},
      createdAt: record.created as string,
      updatedAt: record.updated as string,
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await deleteConversation(this.client, id)
  }

  // ── working memory (stub — not used by the support agent) ─────────────────

  async getWorkingMemory(params: {
    conversationId?: string
    userId?: string
    scope: WorkingMemoryScope
  }): Promise<string | null> {
    const conv = params.conversationId
      ? await this.findConv(params.userId ?? "", params.conversationId)
      : null
    if (!conv) return null
    const wm = conv.workingMemory as Record<string, string> | undefined
    return wm?.[params.scope] ?? null
  }

  async setWorkingMemory(params: {
    conversationId?: string
    userId?: string
    content: string
    scope: WorkingMemoryScope
  }): Promise<void> {
    if (!params.conversationId) return
    const conv = await this.findConv(
      params.userId ?? "",
      params.conversationId
    )
    if (!conv) return
    const wm = (conv.workingMemory as Record<string, string>) ?? {}
    wm[params.scope] = params.content
    await updateConversation(this.client, conv.id as string, {
      // workingMemory is not in the PB schema — we piggyback on messages or
      // skip. For now this is a no-op since the support agent doesn't use it.
    })
  }

  async deleteWorkingMemory(_params: {
    conversationId?: string
    userId?: string
    scope: WorkingMemoryScope
  }): Promise<void> {
    // No-op — working memory is not critical for the support agent.
  }

  // ── workflow state (stub — not used) ──────────────────────────────────────

  async getWorkflowState(
    _executionId: string
  ): Promise<WorkflowStateEntry | null> {
    return null
  }

  async queryWorkflowRuns(
    _query: WorkflowRunQuery
  ): Promise<WorkflowStateEntry[]> {
    return []
  }

  async setWorkflowState(
    _executionId: string,
    _state: WorkflowStateEntry
  ): Promise<void> {}

  async updateWorkflowState(
    _executionId: string,
    _updates: Partial<WorkflowStateEntry>
  ): Promise<void> {}

  async getSuspendedWorkflowStates(
    _workflowId: string
  ): Promise<WorkflowStateEntry[]> {
    return []
  }

  // ── step records (stub — not used by the support agent) ───────────────────

  async saveConversationSteps(
    _steps: ConversationStepRecord[]
  ): Promise<void> {}

  async getConversationSteps(
    _userId: string,
    _conversationId: string,
    _options?: GetConversationStepsOptions
  ): Promise<ConversationStepRecord[]> {
    return []
  }

  // ── internal helpers ──────────────────────────────────────────────────────

  /** Find a conversation by (userId, threadId) — the primary lookup path. */
  private async findConv(
    userId: string,
    threadId: string
  ): Promise<Record<string, unknown> | null> {
    return findConversationByThread(this.client, userId, threadId)
  }

  /** Persist the messages array to the conversation row (upsert). */
  private async saveMessages(
    userId: string,
    threadId: string,
    messages: UIMessage[]
  ): Promise<void> {
    const conv = await this.findConv(userId, threadId)
    if (conv) {
      await updateConversation(this.client, conv.id as string, { messages })
    } else {
      await createConversation(this.client, {
        user: userId,
        threadId,
        messages,
      })
    }
  }
}
