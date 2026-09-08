import { Hono } from "hono"
import type { UIMessage } from "ai"
import { aiChatBodySchema } from "../contracts"
import { getSupportAgent } from "../services/ai"

// Public support chat (phase 1 — no auth, like /api/stats). The pwa streams
// its conversation to the support agent and gets back a
// UIMessageStreamResponse, which Assistant UI consumes directly. Memory is
// scoped by conversationId — the client's `id` (Assistant Chat transport)
// doubles as the stable thread id.
export const ai = new Hono().post("/chat", async (c) => {
  const body = aiChatBodySchema.parse(await c.req.json())
  const messages = body.messages as UIMessage[]

  if (!messages.length) {
    return c.json({ error: "no messages provided" }, 400)
  }

  const agent = await getSupportAgent(body.locale)
  const conversationId = body.conversationId ?? body.id ?? "default-thread"
  const lastMessage = messages[messages.length - 1]

  // Phase 1: single-shot grounding — we send only the latest user message and
  // rely on the system instructions (the knowledge base) for context. Memory
  // keeps the thread coherent across turns in this session.
  const result = await agent.streamText([lastMessage], {
    memory: {
      userId: "anonymous",
      conversationId,
    },
  })

  return result.toUIMessageStreamResponse()
})
