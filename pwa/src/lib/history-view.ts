// Pure history-view helpers: bucket shopping events into day groups and render
// relative day headings. Extracted from views/history.tsx so the date grouping
// and generic-days logic are testable without a React environment.

import { m } from "@/paraglide/messages"
import { getLocale } from "@/paraglide/runtime"
import type { HistoryEvent } from "@/stores/types"

// Day key in the form YYYY-MM-DD (zero-padded so lexicographic order matches
// chronological order; month is 0-indexed, matching Date#getMonth).
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

// One cached formatter per locale — Intl.DateTimeFormat construction is
// comparatively expensive, and the locale is resolved at call time so headings
// render in the active language rather than the runtime default.
const dayFormatters = new Map<string, Intl.DateTimeFormat>()

function dayFormatterFor(locale: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    dayFormatters.set(locale, formatter)
  }
  return formatter
}

// Human heading for a day key. Relative labels ("Today"/"Yesterday") are
// computed against `now` so the logic is deterministic and testable; other days
// fall back to a locale short date.
export function formatDayHeading(
  key: string,
  now: number = Date.now()
): string {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(year, month, day)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(today.getTime()) === key) return m.historyToday()
  if (dayKey(yesterday.getTime()) === key) return m.historyYesterday()
  return dayFormatterFor(getLocale()).format(date)
}

export interface HistoryDayGroup {
  key: string
  events: HistoryEvent[]
}

// Buckets events by day, newest day first, and sorts each bucket newest-first.
export function groupByDay(events: HistoryEvent[]): HistoryDayGroup[] {
  const byDay = new Map<string, HistoryEvent[]>()
  for (const event of events) {
    const key = dayKey(event.timestamp)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(event)
    else byDay.set(key, [event])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, bucket]) => ({
      key,
      events: bucket.sort((x, y) => y.timestamp - x.timestamp),
    }))
}
