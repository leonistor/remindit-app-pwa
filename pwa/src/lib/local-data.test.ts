// Unit tests for the local-data restore plumbing: the envelope parser
// (parseLocalDataEnvelope) and the confirm-dialog date formatting.
//
// Fixtures are plain hand-written objects — deliberately independent of
// collectLocalData/stores so a store change can't mask a parser regression.

import { describe, expect, test } from "@rstest/core"
import {
  formatExportedAt,
  isNewerBackupVersion,
  type LocalDataEnvelope,
  LocalDataValidationError,
  parseLocalDataEnvelope,
  readLocalDataFile,
} from "@/lib/local-data"
import { DEFAULT_PALETTE_ID } from "@/lib/palettes"
import { UNCATEGORIZED_ID } from "@/stores/types"
import { APP_VERSION } from "@/version"

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

  test("passes an unknown future version string through untouched", () => {
    // The parser never gates on the app version (that's the import UI's job
    // via isNewerBackupVersion) — it only requires *a* string.
    const parsed = parseLocalDataEnvelope(
      JSON.stringify({
        version: "99.0.0",
        exportedAt: "2026-09-01T10:30:00.000Z",
        data: VALID_DATA,
      })
    )
    expect(parsed.version).toBe("99.0.0")
  })

  test("keeps only inline data: image avatars from the user profile", () => {
    const avatarOf = (avatar: unknown): string =>
      parseLocalDataEnvelope(envelopeJson({ user: { avatar } })).data.user
        .avatar

    // Any non-`data:image/` string would issue a network request when rendered
    // as an <img> src — remote URLs and schemes are rejected outright, and
    // non-strings coerce to "" like the rest of the profile fields.
    expect(avatarOf("javascript:alert(1)")).toBe("")
    expect(avatarOf("https://evil.example/a.png")).toBe("")
    expect(avatarOf(42)).toBe("")
    expect(avatarOf("data:image/svg+xml;base64,abc")).toBe(
      "data:image/svg+xml;base64,abc"
    )
    expect(avatarOf("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA"
    )
  })

  test("drops catalog rows without a usable identity (id + name)", () => {
    expect(
      parseLocalDataEnvelope(envelopeJson({ catalog: [{}] })).data.catalog
    ).toEqual([])
    expect(
      parseLocalDataEnvelope(
        envelopeJson({ catalog: [{ id: "item-1", name: "" }] })
      ).data.catalog
    ).toEqual([])
    // A row with identity but no categoryId is NOT dropped — it lands on the
    // sentinel (covered by the dedicated test below).
  })

  test("lands catalog rows with a missing or empty categoryId on the sentinel", () => {
    const categoryIdOf = (categoryId: unknown): string =>
      parseLocalDataEnvelope(
        envelopeJson({ catalog: [{ id: "item-1", name: "Apple", categoryId }] })
      ).data.catalog[0].categoryId

    expect(categoryIdOf(undefined)).toBe(UNCATEGORIZED_ID)
    expect(categoryIdOf("")).toBe(UNCATEGORIZED_ID)
    expect(categoryIdOf(42)).toBe(UNCATEGORIZED_ID)
    expect(categoryIdOf("cat-produce")).toBe("cat-produce")
  })

  test("coerces list rows' checked by truthiness and repairs unusable addedAt", () => {
    const listRowOf = (
      row: Record<string, unknown>
    ): LocalDataEnvelope["data"]["list"][number] =>
      parseLocalDataEnvelope(envelopeJson({ list: [row] })).data.list[0]

    expect(listRowOf({ id: "e1", itemId: "item-1", checked: 1 }).checked).toBe(
      true
    )
    expect(
      listRowOf({ id: "e1", itemId: "item-1", checked: "yes" }).checked
    ).toBe(true)
    expect(listRowOf({ id: "e1", itemId: "item-1", checked: 0 }).checked).toBe(
      false
    )

    // A non-finite addedAt falls back to Date.now() — "just imported", not
    // "ancient". Asserted against a tolerance, never a pinned literal.
    const repaired = listRowOf({
      id: "e1",
      itemId: "item-1",
      addedAt: "not-a-number",
    }).addedAt
    expect(Number.isFinite(repaired)).toBe(true)
    expect(Math.abs(repaired - Date.now())).toBeLessThan(5000)
  })

  test("drops history rows whose action is not exactly add or remove", () => {
    const historyFrom = (row: Record<string, unknown>) =>
      parseLocalDataEnvelope(envelopeJson({ history: [row] })).data.history

    expect(historyFrom({ id: "h1", action: "buy", itemId: "item-1" })).toEqual(
      []
    )
    // A usable row survives with its text fields coerced and a sane timestamp.
    expect(
      historyFrom({ id: "h1", action: "remove", itemId: "item-1" })
    ).toEqual([
      {
        id: "h1",
        action: "remove",
        itemId: "item-1",
        itemName: "",
        categoryId: "",
        categoryName: "",
        timestamp: 0,
      },
    ])
  })

  test("strips unknown extra fields from catalog rows", () => {
    // Rows are rebuilt field-by-field, so hand-edited backups can't inject
    // untyped fields into the persisted stores.
    const parsed = parseLocalDataEnvelope(
      envelopeJson({
        catalog: [
          {
            id: "item-1",
            name: "Apple",
            categoryId: "cat-produce",
            injected: "pwn",
          },
        ],
      })
    )
    expect(parsed.data.catalog[0]).toEqual({
      id: "item-1",
      name: "Apple",
      categoryId: "cat-produce",
    })
  })
})

describe("isNewerBackupVersion", () => {
  // Derived from the real build-time constant so the pin keeps working when
  // the app's own major version bumps.
  const appMajor = Number.parseInt(APP_VERSION.split(".")[0], 10)

  test("is true only when the backup's major is greater than the app's", () => {
    expect(isNewerBackupVersion(`${appMajor + 1}.0.0`)).toBe(true)
    expect(isNewerBackupVersion(`${appMajor + 12}.3.4`)).toBe(true)

    // Equal or lower majors are compatible, even with higher minor/patch.
    expect(isNewerBackupVersion(`${appMajor}.0.0`)).toBe(false)
    expect(isNewerBackupVersion(`${appMajor}.999.9`)).toBe(false)
    expect(isNewerBackupVersion(`${appMajor - 1}.0.0`)).toBe(false)
  })

  test("counts garbage versions as compatible (false)", () => {
    expect(isNewerBackupVersion("")).toBe(false)
    expect(isNewerBackupVersion("abc")).toBe(false)
    expect(isNewerBackupVersion(null as unknown as string)).toBe(false)
  })
})

describe("readLocalDataFile", () => {
  test("returns the parsed envelope for a valid backup file", async () => {
    const raw = JSON.stringify({
      version: "4.3.0",
      exportedAt: "2026-09-01T10:30:00.000Z",
      data: VALID_DATA,
    })
    const file = new File([raw], "remindit-backup.json", {
      type: "application/json",
    })
    await expect(readLocalDataFile(file)).resolves.toEqual(
      parseLocalDataEnvelope(raw)
    )
  })

  test("rejects a file whose contents are not valid JSON", async () => {
    const file = new File(["{not json"], "backup.json", {
      type: "application/json",
    })
    await expect(readLocalDataFile(file)).rejects.toThrow(
      LocalDataValidationError
    )
  })

  test("rejects an oversized file (stubbed size, no 10 MB allocation)", async () => {
    const file = new File(["x"], "backup.json", { type: "application/json" })
    // Stub just above the 10 MB limit — the size check happens before any
    // content read, so the payload never needs to exist.
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 })
    await expect(readLocalDataFile(file)).rejects.toThrow(
      LocalDataValidationError
    )
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
