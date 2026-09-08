// AI support-chat service (phase 1 + Task A persistence + Task B commands).
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
// Task B (app commands, D15): when the authed user supplies a `teamId`, the
// agent gains three tools. `list_items` and `recommend_items` are
// SERVER-executed (they read the user's team via the token-scoped PB client
// and `@remindit/common/recommender`); `add_item` is CLIENT-executed — it has
// NO server `execute` handler, so VoltAgent marks it client-side
// (`Tool.isClientSide()`), the BFF streams the `tool-call` part, and the pwa
// fulfils it against its local stores (createItemAndAddToList → journal → LWW
// → sync) and feeds the result back via the AI SDK's client-tool API. The
// write path never touches the BFF/schema (offline-safe, reuses the sync
// engine).
//
// Agents are NOT cached — each request creates its own Agent so the Memory
// instance can be user-scoped (PocketBase client is per-request via forToken)
// and the tool closures capture that request's client + teamId.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { AgentTool } from "@voltagent/core"
import { Agent, Memory, tool as voltTool } from "@voltagent/core"
import type PocketBase from "pocketbase"
import { z } from "zod"
import { env } from "../env"
import { PocketBaseStorageAdapter } from "../lib/voltagent-pocketbase-storage"
import {
  buildAIContext,
  formatListForTool,
  formatRecommendationsForTool,
} from "./ai-context"

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
  locale: string,
  commands: boolean
): Promise<{ instructions: string }> {
  // Read at build/runtime so a content edit is picked up without a rebuild; the
  // file lives in bff/content (Bun reads it relative to this module).
  const content = (
    await Bun.file(`${import.meta.dir}/../../content/support-en.md`).text()
  ).trim()

  const language = LOCALE_LANGUAGE[locale] ?? "English"

  const commandsNote = commands
    ? `
App commands (the signed-in user's active shopping list, teamId-provided):
- "what's on my list" / "show my list" → call \`list_items\` and summarize the result.
- "what should I buy" / "recommendations" → call \`recommend_items\` and summarize the result.
- "add X [to category]" → call \`add_item\` with the item name (and a category if the user named one). The client executes the add; after the tool result, confirm briefly in ${language}. Never invent a category — leave it out if the user didn't name one.
Only use these tools when the user clearly asks about their own list. Ordinary support questions must not trigger them.`
    : ""

  const instructions = `You are the RemindIt support assistant, embedded in the RemindIt shopping-list PWA.

Answer the user's question about RemindIt using ONLY the support knowledge base provided below. Be concise, friendly and accurate. If a question is not covered by the knowledge base, say you don't have an answer yet and suggest rephrasing or asking again later — never invent features.
${commandsNote}

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
 *
 * `commands` (Task B) enables the app-command tools — requires an authed PB
 * client and the pwa's active teamId. When absent, the agent is a plain
 * support assistant.
 */
export async function createSupportAgent(
  locale: string,
  auth?: { client: PocketBase },
  commands?: { teamId: string }
): Promise<Agent> {
  const canRunCommands = Boolean(auth && commands?.teamId)
  const { instructions } = await supportGrounding(locale, canRunCommands)
  const { model, modelId } = resolveModel()

  // Authenticated: PB-backed Memory (persists across server restarts).
  // Anonymous: default InMemoryStorageAdapter (lost on restart).
  const memory = auth
    ? new Memory({ storage: new PocketBaseStorageAdapter(auth.client) })
    : undefined

  // Narrowed locally so the Agent builder needs no non-null assertions.
  const tools =
    auth && commands?.teamId
      ? buildCommandTools(auth.client, commands.teamId)
      : undefined

  const agent = new Agent({
    name: "remindit-support",
    purpose:
      "Answer RemindIt support and help questions from the knowledge base" +
      (canRunCommands
        ? ", and manage the user's shopping list via commands"
        : ""),
    model,
    instructions,
    memory,
    tools,
    maxOutputTokens: 2048,
    temperature: 0.3,
  })

  console.log(
    `[ai] support agent created (locale=${locale}, provider=${env.aiProvider}, model=${modelId}, memory=${auth ? "pb" : "in-memory"}, commands=${canRunCommands})`
  )
  return agent
}

/**
 * Task B command tools (D15). `list_items` / `recommend_items` are
 * server-executed — their handlers fetch the user's team context lazily (once
 * per agent, via the token-scoped client) and format it for the model.
 * `add_item` deliberately has NO `execute` handler → VoltAgent marks it
 * client-side and streams the tool-call part; the pwa fulfils it locally and
 * feeds the result back (the tool-result loop, see plan §Wrinkle 2).
 */
function buildCommandTools(client: PocketBase, teamId: string): AgentTool[] {
  // Lazily fetched once per agent instance: the route builds a fresh agent per
  // request, so the cache never spans users/teams.
  let contextPromise: ReturnType<typeof buildAIContext> | undefined
  const loadContext = () => (contextPromise ??= buildAIContext(client, teamId))

  return [
    voltTool({
      name: "list_items",
      description:
        "Show the user's current shopping list (the pending, unchecked items, grouped with their category).",
      parameters: z.object({}),
      execute: async () => formatListForTool(await loadContext()),
    }),
    voltTool({
      name: "recommend_items",
      description:
        "Recommend items the user should buy next, derived from their shopping history and catalog. Returns the top suggestions with their category.",
      parameters: z.object({}),
      execute: async () => formatRecommendationsForTool(await loadContext()),
    }),
    voltTool({
      name: "add_item",
      description:
        "Add an item to the user's shopping list. Include the category only if the user named one.",
      parameters: z.object({
        name: z.string().describe("The item name to add"),
        category: z
          .string()
          .optional()
          .describe("Optional category name the user mentioned"),
      }),
      // D15 refinement (empirically surfaced while building Task B): the BFF
      // NEVER writes to the user's list, and VoltAgent's streamText input
      // validation rejects the AI SDK's `tool`-role result message a client
      // would re-send — so a pure client-side tool can't complete its turn
      // across POSTs in this stack. Instead this execute returns only a
      // confirmation the model can continue from (single POST), while the REAL
      // write happens client-side: the pwa's `onToolCall` observes the tool
      // call and runs `createItemAndAddToList` against the local stores
      // (journal → LWW → sync), offline-safe. The BFF's confirmation is
      // narrative; the pwa is the source of truth.
      execute: async (args) => {
        const { name, category } = args as {
          name: string
          category?: string
        }
        return `Added "${name}"${category ? ` to ${category}` : ""} to the shopping list.`
      },
    }),
  ]
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
