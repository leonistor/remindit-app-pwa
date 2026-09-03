// Notifications card (D4, docs/SYNC.md §Notifications): the in-app surface
// for the realtime notification feed. Purely store-reactive — the sync engine
// refreshes on connect and on realtime events; this is just the control
// surface, the same split as sync-card / shared-list-card. Renders nothing
// while signed out.

import { useStore } from "@nanostores/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/custom/button"
import { dayKey, formatDayHeading } from "@/lib/history-view"
import { cn } from "@/lib/utils"
import { m } from "@/paraglide/messages"
import {
  $notifications,
  $unreadCount,
  markRead,
  type NotificationItem,
} from "@/stores"
import { $syncSession } from "@/stores/sync"

// Relative-or-short date for a row, reusing the history view's cached,
// locale-aware day formatting (Today/Yesterday, short locale date otherwise).
// Missing or unparseable timestamps render no date at all.
const formatNotificationDate = (created?: string): string | null => {
  if (!created) return null
  const timestamp = Date.parse(created)
  if (Number.isNaN(timestamp)) return null
  return formatDayHeading(dayKey(timestamp))
}

// Human text per type with payload interpolation; unknown types and missing
// payload fields fall back to the generic message.
const messageFor = (item: NotificationItem): string => {
  const { teamName, actorUsername } = item.payload ?? {}
  if (item.type === "member.added" && actorUsername && teamName) {
    return m.notificationMemberAdded({ actor: actorUsername, team: teamName })
  }
  if (item.type === "member.left" && actorUsername && teamName) {
    return m.notificationMemberLeft({ actor: actorUsername, team: teamName })
  }
  if (item.type === "member.removed" && teamName) {
    return m.notificationMemberRemoved({ team: teamName })
  }
  return m.notificationGeneric()
}

export function NotificationsCard() {
  const session = useStore($syncSession)
  const items = useStore($notifications)
  const unread = useStore($unreadCount)
  // Row-level busy: only the clicked row's button spins, the rest stay
  // disabled while a PATCH is in flight.
  const [markingId, setMarkingId] = useState<string | null>(null)

  if (!session) return null

  const markNotification = async (id: string) => {
    setMarkingId(id)
    try {
      await markRead(id)
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader
        title={m.notificationsTitle()}
        description={m.notificationsDescription()}
      >
        {unread > 0 && (
          <CardAction>
            <Badge size="sm">
              {unread === 1
                ? m.notificationsUnreadOne()
                : m.notificationsUnreadOther({ count: unread })}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {m.notificationsEmpty()}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const date = formatNotificationDate(item.created)
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3",
                    item.read && "opacity-60"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      item.read ? "bg-transparent" : "bg-primary"
                    )}
                  />
                  <p
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      item.read && "text-muted-foreground"
                    )}
                  >
                    {messageFor(item)}
                  </p>
                  {date && (
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {date}
                    </span>
                  )}
                  {!item.read && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={markingId === item.id}
                      disabled={markingId !== null}
                      onClick={() => void markNotification(item.id)}
                    >
                      {m.notificationsMarkRead()}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
