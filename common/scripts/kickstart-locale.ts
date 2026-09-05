/**
 * Kick-start translations for new locales with a local Ollama model
 * (default: translategemma:12b, evaluated 2026-09-04 against the human ro
 * translation — see pwa/docs/DEV.md §Internationalization).
 *
 * The shared catalog lives in this module (`common/messages` + the inlang
 * project in `common/project.inlang`) — pwa and web both compile from it.
 *
 * Usage: bun run kickstart:locale -- <locale,locale,...> [model]
 *   e.g. bun run kickstart:locale -- de,fr,uk translategemma:12b
 *
 * What it does per target locale:
 *   - adds the locale to project.inlang/settings.json (so paraglide compiles it)
 *   - translates every en.json key that the target file does not have yet
 *     (merge mode — reruns only fill gaps)
 *   - tuned prompt: informal "you" (RemindIt's voice), verbatim {placeholders},
 *     no invented punctuation, exactly one translation (no hedging)
 *   - post-fixes: strips a trailing "." the source does not have
 *   - safety nets: a placeholder mismatch or repeated request failure keeps the
 *     English text and reports the key — those need human review before ship
 *
 * Requires a running Ollama with the model pulled. English (baseLocale) is
 * authoritative; generated files are DRAFTS until reviewed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const moduleDir = join(import.meta.dir, "..")
const messagesDir = join(moduleDir, "messages")
const settingsPath = join(moduleDir, "project.inlang", "settings.json")

const [localesArg, model = "translategemma:12b"] = process.argv.slice(2)
if (!localesArg) {
  console.error(
    "usage: bun run kickstart:locale -- <locale,locale,...> [model]"
  )
  process.exit(1)
}
const targets = localesArg
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean)

const CONCURRENCY = 4
const RETRIES = 4
const API = "http://127.0.0.1:11434"

// --- ollama reachability + model presence -----------------------------------
const tags = (await fetch(`${API}/api/tags`).then((r) => r.json())) as {
  models?: { name: string }[]
}
const installed = (tags.models ?? []).some(
  (m) => m.name.split(":")[0] === model.split(":")[0]
)
if (!installed) {
  console.error(
    `model "${model}" not found in ollama — pull it first (ollama pull ${model})`
  )
  process.exit(1)
}

// --- inputs ------------------------------------------------------------------
type MessageFile = Record<string, string>
const readJson = (path: string): MessageFile =>
  JSON.parse(readFileSync(path, "utf8")) as MessageFile

const en = readJson(join(messagesDir, "en.json"))
const schema = en.$schema ?? "https://inlang.com/schema/inlang-message-format"
const keys = Object.keys(en).filter((k) => k !== "$schema")

const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
  baseLocale: string
  locales: string[]
}

// Human-readable language names via ICU (works for any locale code).
const display = new Intl.DisplayNames(["en"], { type: "language" })

// --- tuned prompt (evaluated; see the doc bullet in docs/DEV.md) -------------
const prompt = (
  lang: string,
  code: string,
  text: string
) => `You are a professional English (en) to ${lang} (${code}) translator. Your goal is to accurately convey the meaning and nuances of the original English text while adhering to ${lang} grammar, vocabulary, and cultural sensitivities.
Produce only the ${lang} translation, without any additional explanations or commentary. This is a friendly consumer shopping-list app: address the user informally (in ${lang}, use the informal "you" — tu form — never the formal polite form). If the source text contains placeholders in curly braces, keep them exactly as they are — never translate, rename, or reorder them. Some texts are sentence FRAGMENTS that the app completes at runtime — translate only what is given, never complete the sentence or append anything. Do not add any punctuation that the source text does not have. Produce exactly one translation — never list alternatives. Please translate the following English text into ${lang}:


${text}`

// Broadened token scan: the source uses ASCII tokens, but a hallucinating
// model can emit non-ASCII (`{назва}`) or empty (`{}`) braces — any `{…}` in
// the output that isn't in the source must fail the safety net, or paraglide
// compiles the invented token as a required input and typecheck breaks.
const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).sort()

// Strip a trailing "." the source does not have (the model pads short labels).
const alignPunctuation = (source: string, output: string): string =>
  /[.!?…:]/.test(source.slice(-1)) || !output.endsWith(".")
    ? output
    : output.slice(0, -1).trimEnd()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function translateOnce(
  lang: string,
  code: string,
  text: string
): Promise<
  { ok: true; text: string } | { ok: false; retry: boolean; err: string }
> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt(lang, code, text) }],
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retry: true, err: `${res.status} ${res.statusText}` }
  }
  if (!res.ok) {
    return { ok: false, retry: false, err: `${res.status} ${res.statusText}` }
  }
  const json = (await res.json()) as { message?: { content?: string } }
  const out = json.message?.content?.trim()
  return out
    ? { ok: true, text: out }
    : { ok: false, retry: true, err: "empty response" }
}

async function translate(
  key: string,
  code: string,
  lang: string,
  text: string
): Promise<string> {
  let lastErr = ""
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const result = await translateOnce(lang, code, text)
      if (result.ok) {
        const cleaned = alignPunctuation(text, result.text)
        // Safety net: a renamed/lost placeholder silently breaks paraglide
        // args — keep English and surface the key for human review instead.
        if (placeholders(cleaned).join(",") === placeholders(text).join(",")) {
          return cleaned
        }
        lastErr = `placeholder mismatch (got ${placeholders(cleaned).join(",") || "none"})`
        continue
      }
      lastErr = result.err
      if (!result.retry) break
    } catch (e) {
      lastErr = String(e)
    }
    await sleep(attempt * 3000)
  }
  console.warn(`  ! ${code}/${key}: ${lastErr} — keeping English (review!)`)
  return text
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let index = 0
  let done = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (index < items.length) {
        await worker(items[index++])
        done++
        if (done % 50 === 0) console.log(`  ${done}/${items.length}`)
      }
    })
  )
}

// --- main --------------------------------------------------------------------
for (const code of targets) {
  const lang = display.of(code) ?? code
  if (!settings.locales.includes(code)) {
    settings.locales.push(code)
    console.log(`+ added "${code}" to project.inlang/settings.json`)
  }

  const targetPath = join(messagesDir, `${code}.json`)
  // Resilient read: a corrupt/truncated draft (e.g. from an interrupted run)
  // starts fresh instead of crashing the whole kick-start.
  let existing: MessageFile = {}
  if (existsSync(targetPath)) {
    try {
      existing = JSON.parse(readFileSync(targetPath, "utf8")) as MessageFile
    } catch {
      console.warn(`  ! ${targetPath} unparseable — starting fresh`)
    }
  }
  // Merge mode: fill gaps AND retry English-fallback keys from earlier runs
  // (they equal the source; a genuine translation identical to English is
  // unaffected — it just gets retranslated to the same thing).
  const todo = keys.filter(
    (key) => !(key in existing) || existing[key] === en[key]
  )
  console.log(
    `→ ${code} (${lang}): ${todo.length} of ${keys.length} keys to translate`
  )

  const out: MessageFile = { ...existing }
  await pool(todo, async (key) => {
    out[key] = await translate(key, code, lang, en[key])
  })

  // Same shape as the hand-maintained files: $schema first, en.json key order,
  // 2-space indent, trailing newline.
  const json = `{\n  "$schema": ${JSON.stringify(schema)},\n${keys
    .map(
      (key) =>
        `  ${JSON.stringify(key)}: ${JSON.stringify(out[key] ?? en[key])}`
    )
    .join(",\n")}\n}\n`
  writeFileSync(targetPath, json)
  const fallbacks = keys.filter((key) => out[key] === en[key] && en[key])
  console.log(
    `  wrote ${targetPath}` +
      (fallbacks.length > 0
        ? ` — ${fallbacks.length} key(s) kept English (human review needed):\n    ${fallbacks.join(", ")}`
        : "")
  )
}

writeFileSync(settingsPath, `${JSON.stringify(settings, null, "\t")}\n`)
console.log(
  `\ndone — drafts written. Review them before shipping; paraglide will now compile ${settings.locales.join(", ")}.`
)
