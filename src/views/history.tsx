import { useStore } from "@nanostores/react"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCategoryPalette } from "@/hooks/use-category-palette"
import { BackButton } from "@/components/back-button"
import { formatDayHeading, groupByDay } from "@/lib/history-view"
import { $categories, $history, UNCATEGORIZED_NAME } from "@/stores"
import type { HistoryEvent } from "@/stores/types"

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
})

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

  const groups = useMemo(() => groupByDay(eventsByName), [eventsByName])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="font-bold text-2xl">History</h1>
      </div>

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
