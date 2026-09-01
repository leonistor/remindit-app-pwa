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
import type { UserProfile } from "@/stores/types"
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
// TOLERANT on its elements: rows that are not plain objects (null, numbers,
// nested arrays) are dropped so one malformed entry can't poison a whole store.
// The remaining rows are only shape-checked as objects here — item-level fields
// stay as-is so exports from older versions (missing fields added later)
// import cleanly and the store normalizers backfill them.
function plainObjectArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) {
    throw new LocalDataValidationError(`data.${field} must be an array`)
  }
  return value.filter(isRecord) as T[]
}

// TOLERANT: any missing or non-string profile field becomes "" (via String()
// with a null/undefined fallback) so the result always satisfies UserProfile
// and the profile UI renders an editable blank instead of crashing.
function coerceUser(value: unknown): UserProfile {
  const src = isRecord(value) ? value : {}
  const str = (v: unknown): string =>
    typeof v === "string" ? v : String(v ?? "")
  return {
    username: str(src.username),
    firstName: str(src.firstName),
    lastName: str(src.lastName),
    email: str(src.email),
    avatar: str(src.avatar),
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
 * malformed array items are filtered out. Throws LocalDataValidationError with
 * a short reason otherwise.
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
      catalog: plainObjectArray<EnvelopeData["catalog"][number]>(
        data.catalog,
        "catalog"
      ),
      categories: plainObjectArray<EnvelopeData["categories"][number]>(
        data.categories,
        "categories"
      ),
      list: plainObjectArray<EnvelopeData["list"][number]>(data.list, "list"),
      history: plainObjectArray<EnvelopeData["history"][number]>(
        data.history,
        "history"
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

/** Read + parse a user-picked backup file. */
export async function readLocalDataFile(
  file: File
): Promise<LocalDataEnvelope> {
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
