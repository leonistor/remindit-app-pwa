// Pure history-view helpers: bucket shopping events into day groups and render
// relative day headings. Extracted from views/history.tsx so the date grouping
// and generic-days logic are testable without a React environment.

import type { HistoryEvent } from "@/stores/types"

// Day key in the form YYYY-M-D (month is 0-indexed, matching Date#getMonth).
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

// Human heading for a day key. Relative labels ("Today"/"Yesterday") are
// computed against `now` so the logic is deterministic and testable; other days
// fall back to a locale short date.
export function formatDayHeading(key: string, now: number = Date.now()): string {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(year, month, day)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(today.getTime()) === key) return "Today"
  if (dayKey(yesterday.getTime()) === key) return "Yesterday"
  return dayFormatter.format(date)
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
