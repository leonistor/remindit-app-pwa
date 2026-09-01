import { useStore } from "@nanostores/react"
import { useMemo } from "react"
import { BackButton } from "@/components/back-button"
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
import { formatDayHeading, groupByDay } from "@/lib/history-view"
import { m } from "@/paraglide/messages"
import { getLocale } from "@/paraglide/runtime"
import { $history, UNCATEGORIZED_NAME } from "@/stores"
import type { HistoryEvent } from "@/stores/types"

// Locale-aware time formatting: the active locale is resolved at call time and
// one formatter per locale is cached (Intl.DateTimeFormat construction is
// comparatively expensive).
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

const formatEventTime = (ts: number) => {
  const locale = getLocale()
  let formatter = timeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    })
    timeFormatters.set(locale, formatter)
  }
  return formatter.format(new Date(ts))
}

const HistoryRow = ({ event }: { event: HistoryEvent }) => {
  const palette = useCategoryPalette(event.categoryId)
  return (
    <TableRow>
      <TableCell>{event.itemName}</TableCell>
      <TableCell>
        <Badge pill className={palette.badge}>
          {event.categoryName || UNCATEGORIZED_NAME}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={event.action === "add" ? "success" : "secondary"}>
          {event.action === "add" ? m.historyAdded() : m.historyRemoved()}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatEventTime(event.timestamp)}
      </TableCell>
    </TableRow>
  )
}

const HistoryView = () => {
  const history = useStore($history)

  // Events carry a stored `categoryName` snapshot (see `logHistory`), so we
  // render it as-is — a deleted category keeps its label and a renamed one shows
  // the name it had at event time rather than the live category.
  const groups = useMemo(() => groupByDay(history), [history])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="font-bold text-2xl">{m.historyTitle()}</h1>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">{m.historyEmptyHint()}</p>
      ) : (
        <>
          {groups.slice(0, 7).map(({ key, events }) => (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="font-semibold text-lg">{formatDayHeading(key)}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.historyItemColumn()}</TableHead>
                    <TableHead>{m.historyCategoryColumn()}</TableHead>
                    <TableHead>{m.historyActionColumn()}</TableHead>
                    <TableHead>{m.historyWhenColumn()}</TableHead>
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
            {m.historyMoreComing()}
          </p>
        </>
      )}
    </div>
  )
}

export default HistoryView
