// Unit tests for the history-view date helpers (src/lib/history-view).

import { describe, expect, test } from "@rstest/core"
import { dayKey, formatDayHeading, groupByDay } from "@/lib/history-view"
import type { HistoryEvent } from "@/stores/types"

const event = (id: string, timestamp: number): HistoryEvent => ({
  id,
  action: "add",
  itemId: id,
  itemName: id,
  categoryId: "cat-x",
  timestamp,
})

describe("dayKey", () => {
  test("builds a YYYY-M-D key with a 0-indexed month", () => {
    expect(dayKey(new Date(2026, 0, 15).getTime())).toBe("2026-0-15")
  })
})

describe("formatDayHeading", () => {
  const now = new Date(2026, 0, 15, 12, 0).getTime()

  test("labels the current day as Today", () => {
    expect(formatDayHeading("2026-0-15", now)).toBe("Today")
  })

  test("labels the previous day as Yesterday", () => {
    expect(formatDayHeading("2026-0-14", now)).toBe("Yesterday")
  })

  test("formats older days as a short date", () => {
    const heading = formatDayHeading("2026-0-12", now)
    const expected = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(2026, 0, 12))
    expect(heading).toBe(expected)
  })
})

describe("groupByDay", () => {
  test("buckets by day (newest group first) and sorts each bucket newest-first", () => {
    const d1 = new Date(2026, 0, 14, 10).getTime()
    const d2 = new Date(2026, 0, 15, 10).getTime()

    const newest = event("a", d2)
    const older = event("b", d2 - 1000)
    const previous = event("c", d1)

    const groups = groupByDay([previous, newest, older])

    expect(groups).toEqual([
      { key: "2026-0-15", events: [newest, older] },
      { key: "2026-0-14", events: [previous] },
    ])
  })
})
