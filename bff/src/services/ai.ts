// AI support-chat service (phase 1).
//
// Builds the VoltAgent support agent from the configured provider/model (env,
// D9). Two providers are supported — Ollama on the local LAN host (dev default)
// and OpenRouter with the dedicated RemindIt key — and the active one is picked
// via `AI_PROVIDER`. The agent is grounded on the English support doc
// (`content/support-en.md`) which is kept in sync with the Help/About pages +
// changelog at release time.
//
// VoltAgent sits on the AI SDK: the route just calls `agent.streamText(...).toUIMessageStreamResponse()`
// so the gateway to the pwa's Assistant UI is a single Hono POST /api/ai/chat.
//
// The assistant answers in the user's app locale (language-by-profile): one
// agent per locale is cached (a small, bounded map — 5 locales max). Memory is
// stateless per-conversation (in-memory memory keyed by
// userId/conversationId); persistent memory remains a roadmap item — see
// docs/ROADMAP.md.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { Agent } from "@voltagent/core"
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

const supportAgents = new Map<string, Agent>()

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

/** The support agent for a locale, built lazily so env is read when first used. */
export async function getSupportAgent(locale = "en"): Promise<Agent> {
  const cached = supportAgents.get(locale)
  if (cached) return cached

  const { instructions } = await supportGrounding(locale)
  const { model, modelId } = resolveModel()

  const agent = new Agent({
    name: "remindit-support",
    purpose:
      "Answer RemindIt support and help questions from the knowledge base",
    model,
    instructions,
    maxOutputTokens: 2048,
    temperature: 0.3,
  })

  supportAgents.set(locale, agent)

  console.log(
    `[ai] support agent ready (locale=${locale}, provider=${env.aiProvider}, model=${modelId})`
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
