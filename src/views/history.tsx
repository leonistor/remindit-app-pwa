import { useMemo } from "react"
import { useStore } from "@nanostores/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useCategoryPalette } from "@/hooks/use-category-palette"
import { $categories, $history, UNCATEGORIZED_NAME } from "@/stores"
import type { HistoryEvent } from "@/stores/types"

const dayKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
})

const formatDayHeading = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(year, month, day)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(today.getTime()) === key) return "Today"
  if (dayKey(yesterday.getTime()) === key) return "Yesterday"
  return dayFormatter.format(date)
}

const HistoryRow = ({ event }: { event: HistoryEvent }) => {
  const palette = useCategoryPalette(event.categoryId)
  return (
    <TableRow>
      <TableCell>{event.itemName}</TableCell>
      <TableCell>
        <Badge pill className={palette.badge}>
          {event.categoryId ? event.categoryName : UNCATEGORIZED_NAME}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={event.action === "add" ? "success" : "secondary"}>
          {event.action === "add" ? "Added" : "Removed"}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {timeFormatter.format(new Date(event.timestamp))}
      </TableCell>
    </TableRow>
  )
}

const HistoryView = () => {
  const history = useStore($history)
  const categories = useStore($categories)

  const eventsByName = useMemo(() => {
    const nameById = new Map(categories.map((c) => [c.id, c.name]))
    return history.map((event) => ({
      ...event,
      categoryName: nameById.get(event.categoryId) ?? "",
    }))
  }, [history, categories])

  const groups = useMemo(() => {
    const byDay = new Map<string, HistoryEvent[]>()
    for (const event of eventsByName) {
      const key = dayKey(event.timestamp)
      const bucket = byDay.get(key)
      if (bucket) bucket.push(event)
      else byDay.set(key, [event])
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, events]) => ({
        key,
        events: events.sort((x, y) => y.timestamp - x.timestamp),
      }))
  }, [eventsByName])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <h1 className="font-bold text-2xl">History</h1>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          No shopping history yet. Add and remove items from your list and
          they&rsquo;ll show up here.
        </p>
      ) : (
        <>
          {groups.slice(0, 7).map(({ key, events }) => (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="font-semibold text-lg">{formatDayHeading(key)}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <HistoryRow key={event.id} event={event} />
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}

          <p className="text-muted-foreground text-sm">
            Full history display and search will be implemented soon.
          </p>
        </>
      )}
    </div>
  )
}

export default HistoryView
