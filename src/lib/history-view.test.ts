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
  categoryName: "Category X",
  timestamp,
})

describe("dayKey", () => {
  test("builds a zero-padded YYYY-MM-DD key with a 0-indexed month", () => {
    expect(dayKey(new Date(2026, 0, 15).getTime())).toBe("2026-00-15")
    expect(dayKey(new Date(2026, 8, 2).getTime())).toBe("2026-08-02")
    expect(dayKey(new Date(2026, 9, 30).getTime())).toBe("2026-09-30")
  })
})

describe("formatDayHeading", () => {
  const now = new Date(2026, 0, 15, 12, 0).getTime()

  test("labels the current day as Today", () => {
    expect(formatDayHeading("2026-00-15", now)).toBe("Today")
  })

  test("labels the previous day as Yesterday", () => {
    expect(formatDayHeading("2026-00-14", now)).toBe("Yesterday")
  })

  test("formats older days as a short date", () => {
    const heading = formatDayHeading("2026-00-12", now)
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
      { key: "2026-00-15", events: [newest, older] },
      { key: "2026-00-14", events: [previous] },
    ])
  })

  test("orders single- and double-digit days correctly across months", () => {
    const sept1 = new Date(2026, 8, 1, 10).getTime()
    const sept30 = new Date(2026, 8, 30, 10).getTime()
    const oct1 = new Date(2026, 9, 1, 10).getTime()
    const oct15 = new Date(2026, 9, 15, 10).getTime()

    const groups = groupByDay([
      event("a", oct15),
      event("b", sept1),
      event("c", oct1),
      event("d", sept30),
    ])

    expect(groups.map((g) => g.key)).toEqual([
      "2026-09-15",
      "2026-09-01",
      "2026-08-30",
      "2026-08-01",
    ])
  })

  test("groups multiple events of the same day into one bucket", () => {
    const d = new Date(2026, 8, 30, 10).getTime()
    const e1 = event("a", d)
    const e2 = event("b", d - 1000)
    const e3 = event("c", d - 2000)

    const groups = groupByDay([e3, e1, e2])

    expect(groups).toEqual([{ key: "2026-08-30", events: [e1, e2, e3] }])
  })

  test("orders the 10th before the 2nd of the same month", () => {
    const second = new Date(2026, 8, 2, 10).getTime()
    const tenth = new Date(2026, 8, 10, 10).getTime()

    const groups = groupByDay([event("a", second), event("b", tenth)])

    expect(groups.map((g) => g.key)).toEqual(["2026-08-10", "2026-08-02"])
  })
})
