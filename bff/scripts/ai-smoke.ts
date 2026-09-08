// AI provider/model smoke test (phase 1).
//
// Asks a fixed set of hypothetical support questions to a single configured
// model and prints the answers, to sanity-check the active provider/model on
// the real grounding content. For the fuller list-based comparison between
// candidate models use `bun run model:eval` instead. Run from the repo root:
// `bun run ai-smoke` (uses the root .env, D9). Pure model eval — no BFF server.
//
// Usage:
//   bun run ai-smoke               # one provider (ollama by default)
//   AI_PROVIDER=ollama     bun run ai-smoke
//   AI_PROVIDER=openrouter bun run ai-smoke

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { Agent } from "@voltagent/core"

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
  `${import.meta.dir}/../content/support-en.md`
).text()

const instructions = `You are the RemindIt support assistant. Answer using ONLY the support knowledge base below. Be concise. Respond in English.

SUPPORT KNOWLEDGE BASE:
---
${supportContent}
---`

function buildAgent(provider: string) {
  const model = (() => {
    if (provider === "openrouter") {
      const key = process.env.OPENROUTER_REMINDIT_KEY
      if (!key) throw new Error("OPENROUTER_REMINDIT_KEY not set")
      return createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: key,
        headers: { "HTTP-Referer": "https://www.remindit.me" },
      })(process.env.OPENROUTER_MODEL ?? "openrouter/free")
    }
    return createOpenAICompatible({
      name: "ollama",
      baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://pop-os.lan:11434"}/v1`,
      apiKey: "ollama",
    })(process.env.OLLAMA_MODEL ?? "gemma4:12b")
  })()
  return new Agent({
    name: "remindit-support-smoke",
    model,
    instructions,
    temperature: 0.3,
    maxOutputTokens: 2048,
  })
}

async function runProvider(name: string, agent: Agent) {
  console.log(`\n${"═".repeat(70)}`)
  console.log(`  PROVIDER: ${name}`)
  console.log(`${"═".repeat(70)}`)
  for (const { q } of QUESTIONS) {
    console.log(`\nQ: ${q}`)
    try {
      const res = await agent.generateText(q)
      console.log(`A: ${res.text.trim()}`)
    } catch (err) {
      console.log(`A: <error> ${(err as Error).message}`)
    }
  }
}

const providers =
  process.env.AI_PROVIDER === "ollama" ||
  process.env.AI_PROVIDER === "openrouter"
    ? [process.env.AI_PROVIDER]
    : ["ollama", "openrouter"]

for (const name of providers) {
  try {
    const agent = buildAgent(name)
    await runProvider(name, agent)
  } catch (err) {
    console.error(
      `\n[ai-smoke] provider '${name}' failed to build:`,
      (err as Error).message
    )
  }
}

console.log("\n[ai-smoke] done.")
