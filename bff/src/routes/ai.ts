import { Hono } from "hono"
import type { UIMessage } from "ai"
import { aiChatBodySchema } from "../contracts"
import {
  type AppEnv,
  type AuthContext,
  optionalAuth,
} from "../middleware/auth"
import { createSupportAgent } from "../services/ai"

// Support chat with optional auth (Task A, phase 2): the pwa streams its
// conversation to the support agent and gets back a UIMessageStreamResponse.
// Authenticated users get persistent memory (stored in the `conversations`
// collection via VoltAgent's StorageAdapter); anonymous callers fall back to
// in-memory-only storage. Memory is scoped by conversationId — the client's
// `id` (Assistant Chat transport) doubles as the stable thread id.
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
    const agent = await createSupportAgent(body.locale ?? "en", auth)
    const conversationId = body.conversationId ?? body.id ?? "default-thread"
    const lastMessage = messages[messages.length - 1]

    // Single-shot grounding: we send only the latest user message and rely on
    // the system instructions (the knowledge base) for context. Memory keeps
    // the thread coherent across turns in this session — persistent for authed
    // users, ephemeral for anonymous.
    const result = await agent.streamText([lastMessage], {
      memory: { userId, conversationId },
      userId,
      conversationId,
    })

    return result.toUIMessageStreamResponse()
  })
