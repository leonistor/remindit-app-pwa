import type { UIMessage } from "ai"
import { Hono } from "hono"
import {
  aiChatBodySchema,
  aiContextQuerySchema,
  aiContextSchema,
} from "../contracts"
import { type AppEnv, type AuthContext, optionalAuth } from "../middleware/auth"
import { createSupportAgent } from "../services/ai"
import { buildAIContext } from "../services/ai-context"

// Support chat with optional auth (Task A, phase 2): the pwa streams its
// conversation to the support agent and gets back a UIMessageStreamResponse.
// Authenticated users get persistent memory (stored in the `conversations`
// collection via VoltAgent's StorageAdapter); anonymous callers fall back to
// in-memory-only storage. Memory is scoped by conversationId — the client's
// `id` (Assistant Chat transport) doubles as the stable thread id.
//
// Task B (app commands): an authed request may carry the pwa's active `teamId`
// — the agent then gains the list/recommend/add tools (see services/ai.ts).
// GET /api/ai/context exposes the same team context to the client.
export const ai = new Hono<AppEnv>()
  .use(optionalAuth)
  .post("/chat", async (c) => {
    const body = aiChatBodySchema.parse(await c.req.json())
    const messages = body.messages as UIMessage[]

    if (!messages.length) {
      return c.json({ error: "no messages provided" }, 400)
    }

    const auth = c.get("auth") as AuthContext | undefined
    const userId = auth?.userId ?? "anonymous"
    const agent = await createSupportAgent(
      body.locale ?? "en",
      auth,
      // Commands need a signed-in user's active team; without either the
      // agent stays a plain support assistant.
      auth && body.teamId ? { teamId: body.teamId } : undefined
    )
    const conversationId = body.conversationId ?? body.id ?? "default-thread"
    const lastMessage = messages[messages.length - 1]

    // Single-shot grounding: we send only the latest user message and rely on
    // the system instructions (the knowledge base) for context. Memory keeps
    // the thread coherent across turns in this session — persistent for authed
    // users, ephemeral for anonymous. Command tools (Task B) complete their
    // turns server-side (the `add_item` execute returns a confirmation; the
    // pwa performs the real local write in lockstep via `onToolCall`), so no
    // client re-send is needed.
    const result = await agent.streamText([lastMessage], {
      memory: { userId, conversationId },
      userId,
      conversationId,
    })

    return result.toUIMessageStreamResponse()
  })
  // Task B context contract (authed): the user's current list + categories +
  // recommendations for their active team. 401 without a token (the optional
  // auth middleware sets `auth` only when a Bearer token was present).
  .get("/context", async (c) => {
    const auth = c.get("auth") as AuthContext | undefined
    if (!auth) {
      return c.json({ error: "authentication required" }, 401)
    }
    const { teamId } = aiContextQuerySchema.parse(c.req.query())
    return c.json(
      aiContextSchema.parse(await buildAIContext(auth.client, teamId))
    )
  })
