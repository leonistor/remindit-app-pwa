// Unit tests for the local-data restore plumbing: the envelope parser
// (parseLocalDataEnvelope) and the confirm-dialog date formatting.
//
// Fixtures are plain hand-written objects — deliberately independent of
// collectLocalData/stores so a store change can't mask a parser regression.

import { describe, expect, test } from "@rstest/core"
import {
  formatExportedAt,
  type LocalDataEnvelope,
  LocalDataValidationError,
  parseLocalDataEnvelope,
} from "@/lib/local-data"
import { DEFAULT_PALETTE_ID } from "@/lib/palettes"

const VALID_DATA = {
  catalog: [{ id: "item-1", name: "Apple", categoryId: "cat-produce" }],
  categories: [
    { id: "cat-produce", name: "Produce", frequency: "weekly", color: 0 },
  ],
  list: [
    { id: "entry-1", itemId: "item-1", checked: false, addedAt: 1700000000000 },
  ],
  history: [
    {
      id: "hist-1",
      action: "add",
      itemId: "item-1",
      itemName: "Apple",
      categoryId: "cat-produce",
      categoryName: "Produce",
      timestamp: 1700000000000,
    },
  ],
  user: {
    username: "leo",
    firstName: "Leo",
    lastName: "Nistor",
    email: "leo@example.com",
    avatar: "data:image/svg+xml;base64,abc",
  },
  theme: "dark",
  activePalette: DEFAULT_PALETTE_ID,
  selectedSort: "name",
  accordionOpen: ["cat-produce"],
  onboarded: true,
  selectedDataset: "minimal",
  installDismissed: false,
}

// Serializes a valid envelope with `dataOverrides` merged over VALID_DATA.
// Note: JSON.stringify drops `undefined` values, so passing a key as undefined
// produces an envelope where the field is genuinely absent.
function envelopeJson(dataOverrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: "4.3.0",
    exportedAt: "2026-09-01T10:30:00.000Z",
    data: { ...VALID_DATA, ...dataOverrides },
  })
}

describe("parseLocalDataEnvelope", () => {
  test("parses a valid envelope and passes every field through", () => {
    const parsed = parseLocalDataEnvelope(envelopeJson())
    expect(parsed.version).toBe("4.3.0")
    expect(parsed.exportedAt).toBe("2026-09-01T10:30:00.000Z")
    expect(parsed.data).toEqual(VALID_DATA)
  })

  test("throws LocalDataValidationError on invalid JSON", () => {
    expect(() => parseLocalDataEnvelope("{not json")).toThrow(
      LocalDataValidationError
    )
  })

  test("throws when the envelope structure is missing", () => {
    // version / exportedAt / data are strict: without them it is not a
    // RemindIt backup.
    expect(() =>
      parseLocalDataEnvelope(JSON.stringify({ data: VALID_DATA }))
    ).toThrow(LocalDataValidationError)
    expect(() =>
      parseLocalDataEnvelope(
        JSON.stringify({ version: "4.3.0", data: VALID_DATA })
      )
    ).toThrow(LocalDataValidationError)
    expect(() =>
      parseLocalDataEnvelope(
        JSON.stringify({
          version: "4.3.0",
          exportedAt: "2026-09-01T10:30:00.000Z",
        })
      )
    ).toThrow(LocalDataValidationError)
  })

  test("throws when a collection field is not an array", () => {
    expect(() => parseLocalDataEnvelope(envelopeJson({ catalog: {} }))).toThrow(
      LocalDataValidationError
    )
  })

  test("filters malformed items out of the collections", () => {
    const parsed = parseLocalDataEnvelope(
      envelopeJson({
        catalog: [null, 42, ["nope"], VALID_DATA.catalog[0]],
      })
    )
    expect(parsed.data.catalog).toHaveLength(1)
    expect(parsed.data.catalog[0].id).toBe("item-1")
  })

  test("falls back to defaults for unknown preference values", () => {
    const parsed = parseLocalDataEnvelope(
      envelopeJson({
        theme: "neon",
        activePalette: "nope-palette",
        selectedSort: "random",
      })
    )
    expect(parsed.data.theme).toBe("system")
    expect(parsed.data.activePalette).toBe(DEFAULT_PALETTE_ID)
    expect(parsed.data.selectedSort).toBe("default")
  })

  test("coerces a partial user profile to empty strings", () => {
    const parsed = parseLocalDataEnvelope(
      envelopeJson({ user: { username: "leo", firstName: 42 } })
    )
    expect(parsed.data.user).toEqual({
      username: "leo",
      firstName: "42",
      lastName: "",
      email: "",
      avatar: "",
    })
  })

  test("accepts accordionOpen only as null or a string array", () => {
    const parse = (raw: string): LocalDataEnvelope["data"]["accordionOpen"] =>
      parseLocalDataEnvelope(raw).data.accordionOpen

    expect(parse(envelopeJson({ accordionOpen: null }))).toBeNull()
    expect(parse(envelopeJson({ accordionOpen: ["a", "b"] }))).toEqual([
      "a",
      "b",
    ])
    expect(parse(envelopeJson({ accordionOpen: [1] }))).toBeNull()
    // Missing field (undefined is dropped by JSON.stringify) → null.
    expect(parse(envelopeJson({ accordionOpen: undefined }))).toBeNull()
  })

  test("falls back for missing tolerant scalars (onboarded, dataset, install)", () => {
    const parsed = parseLocalDataEnvelope(
      envelopeJson({
        onboarded: undefined,
        selectedDataset: undefined,
        installDismissed: undefined,
      })
    )
    expect(parsed.data.onboarded).toBe(true)
    expect(parsed.data.selectedDataset).toBe("")
    expect(parsed.data.installDismissed).toBe(false)
  })
})

describe("formatExportedAt", () => {
  test("formats a valid ISO date into a locale-aware string", () => {
    const formatted = formatExportedAt("2026-09-01T10:30:00.000Z")
    expect(formatted.length).toBeGreaterThan(0)
    expect(formatted).not.toBe("2026-09-01T10:30:00.000Z")
  })

  test("returns garbage input unchanged", () => {
    expect(formatExportedAt("not-a-date")).toBe("not-a-date")
  })
})
