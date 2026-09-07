// Model-evaluation harness (phase 1) — compares candidate support-assistant
// models on the real grounding content.
//
// Runs the support-question battery against a LIST of models (not one), so we
// can compare local Ollama candidates and OpenRouter free models side by side
// and pick a default. Pure model eval — no BFF server needed. Run from the
// repo root: `bun run model:eval` (uses the root .env, D9).
//
// Usage:
//   bun run model:eval                               # default model sets
//   --ollama "gemma3:4b,qwen3:8b"                    # override ollama list
//   --openrouter "minimax/minimax-m3:free,thinkingmachines/inkling:free"
//   --only ollama  | --only openrouter               # test one provider
//
// Default model sets are intentionally the candidates under evaluation —
// change them here (or pass overrides) as the selection evolves.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { Agent, type LanguageModel } from "@voltagent/core"

// Default model sets — the 2026-09-07 eval settled on qwen2.5:7b (local) and
// minimax/minimax-m3:free (remote); inkling and nemotron-3-super failed at the
// harness level (agentic-only / Invalid JSON) and were dropped. Change these
// here or pass overrides as the selection evolves.

const OLLAMA_DEFAULT =
  process.env.OLLAMA_EVAL_MODELS ?? "qwen2.5:7b,llama3.1:8b,granite3.3:8b"
const OPENROUTER_DEFAULT =
  process.env.OPENROUTER_EVAL_MODELS ??
  "minimax/minimax-m3:free,nvidia/nemotron-3-ultra-550b-a55b:free,dots-studio/dots-3-note-preview:free"

const QUESTIONS: Array<{ q: string; expects: string }> = [
  {
    q: "How do I share my shopping list with someone else?",
    expects:
      "owner invites by exact username; members switch/leave from Profile",
  },
  {
    q: "Is RemindIt usable offline?",
    expects:
      "yes — everything works offline; nothing is uploaded until you sign in",
  },
  {
    q: "How do I change the color palette?",
    expects: "Profile → color palette, live preview, Van Gogh default",
  },
  {
    q: "What do the red and amber pips mean on my items?",
    expects: "red = overdue, amber = due soon (recommendations)",
  },
  {
    q: "How do I restore my data on a new device?",
    expects:
      "download backup from Profile, restore on any device; fresh install offers restore during onboarding",
  },
  {
    q: "Can RemindIt store photos with my items?",
    expects:
      "no — item attributes (photo, quantity, price) are on the roadmap, not shipped",
  },
]

const supportContent = await Bun.file(
  import.meta.dir + "/../content/support-en.md"
).text()

const instructions = `You are the RemindIt support assistant. Answer using ONLY the support knowledge base below. Be concise and grounded — never invent features. Respond in English.

SUPPORT KNOWLEDGE BASE:
---
${supportContent}
---`

/** Parse `--k v` style args (also accepts `k=v` and bare). */
function args(keys: Array<string>): Record<string, string | undefined> {
  const a = Bun.argv.slice(1)
  const out: Record<string, string | undefined> = {}
  for (let i = 0; i < a.length; i++) {
    const k = a[i]
    if (k.startsWith("--")) {
      const key = k.slice(2)
      const eq = key.indexOf("=")
      if (eq > -1) {
        out[key.slice(0, eq)] = key.slice(eq + 1)
      } else if (i + 1 < a.length && !a[i + 1].startsWith("--")) {
        out[key] = a[++i]
      } else {
        out[key] = "true"
      }
    }
  }
  for (const key of keys) {
    const envVal = process.env[`EVAL_${key.toUpperCase()}`]
    if (envVal) out[key] ??= envVal
  }
  return out
}

function buildAgent(model: LanguageModel): Agent {
  return new Agent({
    name: "remindit-support-eval",
    model,
    instructions,
    temperature: 0.3,
    maxOutputTokens: 2048,
  })
}

function ollamaModel(id: string): LanguageModel {
  return createOpenAICompatible({
    name: "ollama",
    baseURL: (process.env.OLLAMA_BASE_URL ?? "http://pop-os.lan:11434") + "/v1",
    apiKey: "ollama", // Ollama accepts any non-empty key.
  })(id)
}

function openrouterModel(id: string): LanguageModel {
  const key = process.env.OPENROUTER_REMINDIT_KEY
  if (!key) throw new Error("OPENROUTER_REMINDIT_KEY not set (root .env, D9)")
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    headers: { "HTTP-Referer": "https://www.remindit.me" },
  })(id)
}

async function runModel(provider: string, id: string) {
  console.log(`\n${"═".repeat(72)}`)
  console.log(`  ${provider.padEnd(10)} ${id}`)
  console.log(`${"═".repeat(72)}`)
  try {
    const agent = buildAgent(
      provider === "ollama" ? ollamaModel(id) : openrouterModel(id)
    )
    const results: Array<{ q: string; a: string; s: number }> = []
    for (const { q } of QUESTIONS) {
      const t0 = Date.now()
      try {
        const res = await agent.generateText(q)
        results.push({
          q,
          a: res.text.trim(),
          s: Math.round((Date.now() - t0) / 1000),
        })
      } catch (err) {
        results.push({
          q,
          a: `<error> ${(err as Error).message}`,
          s: Math.round((Date.now() - t0) / 1000),
        })
      }
    }
    for (const { q, a, s } of results) {
      console.log(`\nQ (${s}s): ${q}`)
      console.log(`A: ${a.slice(0, 400)}`)
    }
  } catch (err) {
    console.error(`  <skip> ${(err as Error).message}`)
  }
}

const arg = args(["ollama", "openrouter", "only"])

const providers: Array<"ollama" | "openrouter"> =
  arg.only === "ollama" || arg.only === "openrouter"
    ? [arg.only]
    : ["ollama", "openrouter"]

for (const provider of providers) {
  const ids = (
    provider === "ollama"
      ? (arg.ollama ?? OLLAMA_DEFAULT)
      : (arg.openrouter ?? OPENROUTER_DEFAULT)
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  for (const id of ids) await runModel(provider, id)
}

console.log("\n[model:eval] done.")
