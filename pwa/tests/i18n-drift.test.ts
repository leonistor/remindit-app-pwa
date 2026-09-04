// Drift guard for the translation files (inlang message format).
//
// `messages/en.json` is the baseLocale — a key used in code but missing from
// it breaks `typecheck` (paraglide's generated `m.*` types). `messages/ro.json`
// has no such enforcement: a missing key silently falls back to English at
// runtime. These assertions keep the two files in lockstep so translations
// don't erode:
//   - key parity: every en key must exist in ro (extra ro-only keys WARN only
//     — they may be work-in-progress; run `bun run i18n:check` to see them)
//   - no empty values: an empty string is an untranslated placeholder
//   - ICU placeholder parity: `{token}` sets must match between locales
//   - match-variant sanity: `|`-style variants (arrays) appear on both sides
// Failures list the offending keys — fix messages/*.json, never this test.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "@rstest/core"

type MessageFile = Record<string, unknown>

const readMessages = (locale: string): MessageFile => {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "..", "messages", `${locale}.json`), "utf8")
  ) as MessageFile
  // `$schema` is editor metadata, not a message — drop it from both sides.
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "$schema")
  )
}

const en = readMessages("en")
const ro = readMessages("ro")

const isEmpty = (value: unknown): boolean =>
  Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim()

// ICU-style interpolations, e.g. {count}. JSON.stringify makes the scan work
// for both plain strings and array-of-match-variant values.
const placeholders = (value: unknown): string[] =>
  [...JSON.stringify(value ?? "").matchAll(/\{[a-zA-Z0-9_]+\}/g)]
    .map((match) => match[0])
    .sort()

// Paraglide match syntax: an array of variants (or a legacy `|`-separated
// string) marks the value as a match/plural message.
const isVariant = (value: unknown): boolean =>
  Array.isArray(value) || String(value).includes("|")

describe("i18n drift guard (messages/en ↔ messages/ro)", () => {
  test("every en key exists in ro (no silent English fallbacks)", () => {
    const missing = Object.keys(en).filter((key) => !(key in ro))
    expect(missing).toEqual([])
  })

  test("no empty translations in either locale", () => {
    const empty = Object.keys(en)
      .filter((key) => key in ro)
      .filter((key) => isEmpty(en[key]) || isEmpty(ro[key]))
    expect(empty).toEqual([])
  })

  test("ICU placeholders match between locales", () => {
    const mismatched = Object.keys(en)
      .filter((key) => key in ro)
      .filter(
        (key) =>
          placeholders(en[key]).join(",") !== placeholders(ro[key]).join(",")
      )
    expect(mismatched).toEqual([])
  })

  test("match variants (`|`) appear on both sides", () => {
    const mismatched = Object.keys(en)
      .filter((key) => key in ro)
      .filter((key) => isVariant(en[key]) !== isVariant(ro[key]))
    expect(mismatched).toEqual([])
  })

  test("ro-only keys (warn only — promote or remove eventually)", () => {
    const extra = Object.keys(ro).filter((key) => !(key in en))
    if (extra.length > 0) {
      console.warn(
        `[i18n] ro-only keys missing from en.json: ${extra.join(", ")}`
      )
    }
    // Warn-only by design (work-in-progress keys are allowed to live here
    // temporarily); the assertion just keeps the test formally asserted.
    expect(extra).toBeInstanceOf(Array)
  })
})
