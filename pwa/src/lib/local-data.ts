// Helpers for the "My local data" card in Profile.
//
// Download: serializes every persisted store into a single JSON envelope.
// Erase: delegates to `wipeAllData()` (src/stores/commands.ts) — the cross-store
// reset lives with the other store commands; this module only shapes the UI
// surface. The wipe clears all `remindit:` data and resets the in-memory stores
// so the onboarding guard (router.tsx) redirects to /onboarding.

import { getActiveLocale } from "@/lib/locale"
import { DEFAULT_PALETTE_ID, getPalette } from "@/lib/palettes"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { wipeAllData } from "@/stores/commands"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { $onboarded, $selectedDatasetId } from "@/stores/onboarding"
import { $activePaletteId } from "@/stores/palette"
import { $installDismissed } from "@/stores/pwa-install"
import { $theme, type ThemeMode } from "@/stores/theme"
import {
  type CatalogItem,
  type HistoryEvent,
  type ListEntry,
  UNCATEGORIZED_ID,
  type UserProfile,
} from "@/stores/types"
import {
  $accordionOpen,
  $selectedSort,
  SELECTED_SORT_ORDER,
  type SelectedSort,
} from "@/stores/ui"
import { $user } from "@/stores/user"
import { APP_VERSION } from "@/version"

export interface LocalDataEnvelope {
  /** App version at export time (from package.json via rsbuild define). */
  version: string
  /** ISO-8601 timestamp of the export. */
  exportedAt: string
  /** Snapshot of every persisted store. */
  data: {
    catalog: ReturnType<typeof $catalog.get>
    categories: ReturnType<typeof $categories.get>
    list: ReturnType<typeof $list.get>
    history: ReturnType<typeof $history.get>
    user: ReturnType<typeof $user.get>
    theme: ReturnType<typeof $theme.get>
    activePalette: ReturnType<typeof $activePaletteId.get>
    selectedSort: ReturnType<typeof $selectedSort.get>
    accordionOpen: ReturnType<typeof $accordionOpen.get>
    onboarded: ReturnType<typeof $onboarded.get>
    selectedDataset: ReturnType<typeof $selectedDatasetId.get>
    installDismissed: ReturnType<typeof $installDismissed.get>
  }
}

/** Collect a snapshot of all persisted stores. */
export function collectLocalData(): LocalDataEnvelope {
  return {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      catalog: $catalog.get(),
      categories: $categories.get(),
      list: $list.get(),
      history: $history.get(),
      user: $user.get(),
      theme: $theme.get(),
      activePalette: $activePaletteId.get(),
      selectedSort: $selectedSort.get(),
      accordionOpen: $accordionOpen.get(),
      onboarded: $onboarded.get(),
      selectedDataset: $selectedDatasetId.get(),
      installDismissed: $installDismissed.get(),
    },
  }
}

/**
 * Trigger a browser download of the full local-data envelope.
 * Uses a Blob + object URL so no extra dependency is needed.
 */
export function downloadLocalData(): void {
  const envelope = collectLocalData()
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement("a")
  a.href = url
  a.download = `remindit-data-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Erase all local data. A thin wrapper over `wipeAllData()` (the cross-store
 * command in src/stores/commands.ts) kept here so Profile's call site and the
 * "My local data" naming stay stable.
 */
export function eraseLocalData(): void {
  wipeAllData()
}

// ---------------------------------------------------------------------------
// Restore (JSON import)
// ---------------------------------------------------------------------------

// Thrown by parseLocalDataEnvelope when the file is not a RemindIt backup at
// all (broken JSON or missing envelope structure). Individual *values* are
// never rejected — see the strict/tolerant split below.
export class LocalDataValidationError extends Error {}

// Runtime shape guard for the tolerant parse below.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// STRICT on the collection itself (a non-array is not a RemindIt backup),
// TOLERANT on its rows: rows that are not plain objects (null, numbers, nested
// arrays) are dropped so one malformed entry can't poison a whole store, and
// each surviving row goes through a per-collection coercer that either rebuilds
// a fully typed row (coercing individual fields where safe) or returns null for
// a row that is truly unusable.
function parsedRows<T>(
  value: unknown,
  field: string,
  coerceRow: (row: Record<string, unknown>) => T | null
): T[] {
  if (!Array.isArray(value)) {
    throw new LocalDataValidationError(`data.${field} must be an array`)
  }
  const rows: T[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const row = coerceRow(entry)
    if (row !== null) rows.push(row)
  }
  return rows
}

// Categories are the one collection without an item-level coercer here: rows
// keep their shape as-is and restoreLocalData's downstream normalizers (sentinel
// insertion, frequency + color backfills) repair what they can.
function plainObjectArray<T>(value: unknown, field: string): T[] {
  return parsedRows(value, field, (row) => row as T)
}

// TOLERANT string coercion shared by the profile and history snapshots:
// anything non-string (null, numbers, objects) becomes "" via String()'s
// null/undefined fallback.
function coerceString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "")
}

// Numbers must be finite (JSON can't encode Infinity/NaN, but hand-edited
// backups can); anything else falls back to what the owning store's writer
// would have used.
function coerceFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

// A catalog row is unusable without a non-empty id (identity for lookups and
// deletion cascades) or name (rendered text and the sort key in selectors), so
// either drops the row. An absent or non-string categoryId lands on the
// "uncategorized" sentinel so the item still shows up after restore instead of
// silently falling between category groups. Rows are rebuilt field-by-field, so
// unknown extra fields never leak into the typed stores.
function coerceCatalogRow(row: Record<string, unknown>): CatalogItem | null {
  const id = row.id
  const name = row.name
  if (typeof id !== "string" || !id || typeof name !== "string" || !name) {
    return null
  }
  const categoryId = row.categoryId
  return {
    id,
    name,
    categoryId:
      typeof categoryId === "string" && categoryId
        ? categoryId
        : UNCATEGORIZED_ID,
  }
}

// A list entry keys on its own id and the referenced item id; without either it
// can't be toggled or deduplicated, so the row drops. checked coerces by
// truthiness and addedAt mirrors the addToList writer (Date.now()) so an entry
// with an unusable timestamp reads as "just imported" rather than "ancient".
function coerceListRow(row: Record<string, unknown>): ListEntry | null {
  const id = row.id
  const itemId = row.itemId
  if (typeof id !== "string" || !id || typeof itemId !== "string" || !itemId) {
    return null
  }
  return {
    id,
    itemId,
    checked: Boolean(row.checked),
    addedAt: coerceFiniteNumber(row.addedAt, Date.now()),
  }
}

// History rows are display-only snapshots, so they coerce harder than they
// drop: only a missing id, an action outside "add"/"remove", or a missing
// itemId makes a row unusable. The name/category text falls back to "" (same as
// coerceUser) and an unusable timestamp falls back to 0 so the event sorts as
// the oldest instead of pretending it happened just now.
function coerceHistoryRow(row: Record<string, unknown>): HistoryEvent | null {
  const id = row.id
  if (typeof id !== "string" || !id) return null
  const action = row.action
  if (action !== "add" && action !== "remove") return null
  const itemId = row.itemId
  if (typeof itemId !== "string" || !itemId) return null
  return {
    id,
    action,
    itemId,
    itemName: coerceString(row.itemName),
    categoryId: coerceString(row.categoryId),
    categoryName: coerceString(row.categoryName),
    timestamp: coerceFiniteNumber(row.timestamp, 0),
  }
}

// TOLERANT: any missing or non-string profile field becomes "" so the result
// always satisfies UserProfile and the profile UI renders an editable blank
// instead of crashing. The avatar is stricter by design (local-first): only
// inline `data:image/` URIs survive; any other string (e.g. an https URL) would
// issue a network request when rendered as <img src>, so it becomes "".
function coerceUser(value: unknown): UserProfile {
  const src = isRecord(value) ? value : {}
  return {
    username: coerceString(src.username),
    firstName: coerceString(src.firstName),
    lastName: coerceString(src.lastName),
    email: coerceString(src.email),
    avatar:
      typeof src.avatar === "string" && src.avatar.startsWith("data:image/")
        ? src.avatar
        : "",
  }
}

function coerceTheme(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

// Membership is checked against the live pool (same guard the palette store
// uses on startup), so an id removed upstream falls back to the seed default.
function coercePaletteId(value: unknown): string {
  return typeof value === "string" && getPalette(value)
    ? value
    : DEFAULT_PALETTE_ID
}

function coerceSelectedSort(value: unknown): SelectedSort {
  return SELECTED_SORT_ORDER.find((sort) => sort === value) ?? "default"
}

// `null` means "uninitialized" (the accordion falls back to its defaults);
// anything that isn't a string array is coerced to that same null.
function coerceAccordionOpen(value: unknown): string[] | null {
  if (Array.isArray(value) && value.every((id) => typeof id === "string")) {
    return value as string[]
  }
  return null
}

/**
 * Parse raw JSON text into a validated LocalDataEnvelope.
 *
 * STRICT on envelope structure (version, exportedAt, data + the array/object
 * shapes) — a file without them is not a RemindIt backup, so we fail fast.
 * TOLERANT on individual values so older exports import cleanly: theme /
 * palette / sort fall back to their defaults, user fields coerce to "", and
 * malformed collection rows are dropped or coerced into typed rows (see the
 * per-collection coercers above). Throws LocalDataValidationError with a short
 * reason otherwise.
 */
export function parseLocalDataEnvelope(raw: string): LocalDataEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new LocalDataValidationError("invalid JSON")
  }
  if (!isRecord(parsed)) {
    throw new LocalDataValidationError("envelope must be an object")
  }
  const { version, exportedAt, data } = parsed
  if (typeof version !== "string") {
    throw new LocalDataValidationError("missing version")
  }
  if (typeof exportedAt !== "string") {
    throw new LocalDataValidationError("missing exportedAt")
  }
  if (!isRecord(data)) {
    throw new LocalDataValidationError("missing data object")
  }

  type EnvelopeData = LocalDataEnvelope["data"]
  return {
    version,
    exportedAt,
    data: {
      catalog: parsedRows<EnvelopeData["catalog"][number]>(
        data.catalog,
        "catalog",
        coerceCatalogRow
      ),
      categories: plainObjectArray<EnvelopeData["categories"][number]>(
        data.categories,
        "categories"
      ),
      list: parsedRows<EnvelopeData["list"][number]>(
        data.list,
        "list",
        coerceListRow
      ),
      history: parsedRows<EnvelopeData["history"][number]>(
        data.history,
        "history",
        coerceHistoryRow
      ),
      user: coerceUser(data.user),
      theme: coerceTheme(data.theme),
      activePalette: coercePaletteId(data.activePalette),
      selectedSort: coerceSelectedSort(data.selectedSort),
      accordionOpen: coerceAccordionOpen(data.accordionOpen),
      onboarded: typeof data.onboarded === "boolean" ? data.onboarded : true,
      selectedDataset:
        typeof data.selectedDataset === "string" ? data.selectedDataset : "",
      installDismissed:
        typeof data.installDismissed === "boolean"
          ? data.installDismissed
          : false,
    },
  }
}

// Leading-major extractor: "4.3.0" → 4; empty/garbage → null. Never throws —
// parseInt on an anchored digit run is total.
function parseMajorVersion(version: string): number | null {
  const match = /^\s*(\d+)/.exec(version)
  return match ? Number.parseInt(match[1], 10) : null
}

/**
 * Forward-compat gate for the import UI: true only when the backup's MAJOR
 * version is strictly greater than the running app's (a newer app may write
 * fields this version can't restore). Unparseable versions on either side count
 * as compatible (false).
 */
export function isNewerBackupVersion(version: string): boolean {
  const backupMajor = parseMajorVersion(version)
  const appMajor = parseMajorVersion(APP_VERSION)
  if (backupMajor === null || appMajor === null) return false
  return backupMajor > appMajor
}

// Largest backup file we are willing to read; anything this big is not a
// plausible RemindIt export and would only spike memory while parsing.
const MAX_BACKUP_FILE_BYTES = 10 * 1024 * 1024

/** Read + parse a user-picked backup file. */
export async function readLocalDataFile(
  file: File
): Promise<LocalDataEnvelope> {
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    throw new LocalDataValidationError("backup file is too large (10 MB limit)")
  }
  const raw = await file.text()
  return parseLocalDataEnvelope(raw)
}

/**
 * Locale-aware "exported at" rendering for the confirm dialog; returns the raw
 * string when it can't be parsed as a date.
 */
export function formatExportedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(getActiveLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
