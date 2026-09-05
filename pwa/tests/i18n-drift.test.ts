// Drift guard for the shared translation catalog (inlang message format).
// The catalog lives in `@remindit/common/messages` and is compiled by both pwa
// and web — so this single guard (run by every pwa suite + `i18n:check`)
// protects every consumer.
//
// `messages/en.json` is the baseLocale — a key used in code but missing from it
// breaks `typecheck` (paraglide's generated `m.*` types). `messages/ro.json`
// ships alongside en: a missing ro key silently falls back to English at
// runtime. `de/fr/uk` are DRAFTS — missing keys there are the *intended*
// per-key English fallback, so they may lag en. But drafts must still not
// drift: paraglide aggregates input variables across ALL locales, so an
// invented/missing `{token}` in any locale widens the compiled function inputs
// and breaks every consumer's call sites cryptically.
//
// Assertions:
//   - ro: key parity — every en key must exist (no silent English fallbacks)
//   - de/fr/uk: keys ⊆ en — no orphan/stale keys that fall back in reverse
//   - no empty values anywhere (empty string = an untranslated placeholder)
//   - ICU placeholder parity `{token}` vs en per key, for every locale
//   - match-variant sanity vs en per key, for every locale
//   - ro-only keys WARN only — they may be work-in-progress
// Failures list the offending keys — fix messages/*.json, never this test.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "@rstest/core"

type MessageFile = Record<string, unknown>

const readMessages = (locale: string): MessageFile => {
  const raw = JSON.parse(
    readFileSync(
      join(__dirname, "..", "..", "common", "messages", `${locale}.json`),
      "utf8"
    )
  ) as MessageFile
  // `$schema` is editor metadata, not a message — drop it from both sides.
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "$schema")
  )
}

const en = readMessages("en")
const ro = readMessages("ro")
// Draft locales lag en by design (per-key English fallback) — they are checked
// for drift, not for completeness.
const drafts = ["de", "fr", "uk"].map((locale) => ({
  locale,
  messages: readMessages(locale),
}))

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

describe("i18n drift guard (shared catalog en/ro — strict parity)", () => {
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

describe("i18n drift guard (shared catalog draft locales de/fr/uk)", () => {
  for (const { locale, messages } of drafts) {
    test(`${locale}: every key exists in en (no orphan/stale keys)`, () => {
      const orphaned = Object.keys(messages).filter((key) => !(key in en))
      expect(orphaned).toEqual([])
    })

    test(`${locale}: no empty translations`, () => {
      const empty = Object.keys(en)
        .filter((key) => key in messages)
        .filter((key) => isEmpty(messages[key]))
      expect(empty).toEqual([])
    })

    test(`${locale}: ICU placeholders match en (drafts must not drift)`, () => {
      const mismatched = Object.keys(en)
        .filter((key) => key in messages)
        .filter(
          (key) =>
            placeholders(en[key]).join(",") !==
            placeholders(messages[key]).join(",")
        )
      expect(mismatched).toEqual([])
    })

    test(`${locale}: match variants match en`, () => {
      const mismatched = Object.keys(en)
        .filter((key) => key in messages)
        .filter((key) => isVariant(en[key]) !== isVariant(messages[key]))
      expect(mismatched).toEqual([])
    })
  }
})
