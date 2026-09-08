// AI support-chat service (phase 1 + Task A persistence).
//
// Builds VoltAgent support agents from the configured provider/model (env,
// D9). Two providers are supported — Ollama on the local LAN host (dev default)
// and OpenRouter with the dedicated RemindIt key — and the active one is picked
// via `AI_PROVIDER`. The agent is grounded on the English support doc
// (`content/support-en.md`) which is kept in sync with the Help/About pages +
// changelog at release time.
//
// VoltAgent sits on the AI SDK: the route just calls `agent.streamText(...).toUIMessageStreamResponse()`
// so the gateway to the pwa's Assistant UI is a single Hono POST /api/ai/chat.
//
// Task A (phase 2): authenticated users get persistent memory — a
// PocketBacked StorageAdapter stores the conversation in the `conversations`
// collection. Anonymous callers fall back to in-memory-only storage.
//
// Agents are NOT cached — each request creates its own Agent so the Memory
// instance can be user-scoped (PocketBase client is per-request via forToken).

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { Agent, Memory } from "@voltagent/core"
import type PocketBase from "pocketbase"
import { PocketBaseStorageAdapter } from "../lib/voltagent-pocketbase-storage"
import { env } from "../env"

// Locale code → spoken language for the answer directive. Anything unlisted
// (or absent) falls back to English.
const LOCALE_LANGUAGE: Record<string, string> = {
  en: "English",
  ro: "Romanian",
  de: "German",
  fr: "French",
  uk: "Ukrainian",
}

/** The support knowledge base, loaded once per agent build. */
async function supportGrounding(
  locale: string
): Promise<{ instructions: string }> {
  // Read at build/runtime so a content edit is picked up without a rebuild; the
  // file lives in bff/content (Bun reads it relative to this module).
  const content = (
    await Bun.file(`${import.meta.dir}/../../content/support-en.md`).text()
  ).trim()

  const language = LOCALE_LANGUAGE[locale] ?? "English"

  const instructions = `You are the RemindIt support assistant, embedded in the RemindIt shopping-list PWA.

Answer the user's question about RemindIt using ONLY the support knowledge base provided below. Be concise, friendly and accurate. If a question is not covered by the knowledge base, say you don't have an answer yet and suggest rephrasing or asking again later — never invent features.

Respond in ${language} (the user's app language), while grounding every answer ONLY on the knowledge base below.

SUPPORT KNOWLEDGE BASE:
---
${content}
---`

  return { instructions }
}

/**
 * Create a support agent for a request. Each call creates a fresh Agent so the
 * Memory instance can be user-scoped: authenticated users get a PocketBacked
 * StorageAdapter (persistent), anonymous callers get the default in-memory
 * adapter (ephemeral).
 */
export async function createSupportAgent(
  locale: string,
  auth?: { client: PocketBase }
): Promise<Agent> {
  const { instructions } = await supportGrounding(locale)
  const { model, modelId } = resolveModel()

  // Authenticated: PB-backed Memory (persists across server restarts).
  // Anonymous: default InMemoryStorageAdapter (lost on restart).
  const memory = auth
    ? new Memory({ storage: new PocketBaseStorageAdapter(auth.client) })
    : undefined

  const agent = new Agent({
    name: "remindit-support",
    purpose:
      "Answer RemindIt support and help questions from the knowledge base",
    model,
    instructions,
    memory,
    maxOutputTokens: 2048,
    temperature: 0.3,
  })

  console.log(
    `[ai] support agent created (locale=${locale}, provider=${env.aiProvider}, model=${modelId}, memory=${auth ? "pb" : "in-memory"})`
  )
  return agent
}

function resolveModel() {
  const provider = env.aiProvider
  if (provider === "openrouter") {
    if (!env.openRouterKey) {
      throw new Error(
        "[ai] AI_PROVIDER=openrouter but OPENROUTER_REMINDIT_KEY is not set (root .env, D9)"
      )
    }
    // OpenRouter is OpenAI-compatible; the dedicated provider SDK still emits
    // the older model interface, so the generic provider (with the API key)
    // is the one VoltAgent accepts today.
    const modelId = env.aiModel || env.openRouterModel
    const model = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.openRouterKey,
      headers: { "HTTP-Referer": "https://www.remindit.me" },
    })(modelId)
    return { model, modelId }
  }
  // Default: Ollama on the local LAN host — an OpenAI-compatible endpoint, so
  // the generic provider works unchanged (the community ollama-ai-provider
  // still emits the older LanguageModel interface; this one is maintained).
  const modelId = env.aiModel || env.ollamaModel
  const model = createOpenAICompatible({
    name: "ollama",
    baseURL: `${env.ollamaBaseUrl}/v1`,
    apiKey: "ollama", // Ollama accepts any non-empty key.
  })(modelId)
  return { model, modelId }
}
