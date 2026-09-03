// In-app notification consumer (D4, docs/SYNC.md §Notifications): the store
// side of the realtime notification channel. The sync engine refreshes the
// list once per successful connect and re-refreshes (debounced) on realtime
// events from the user-scoped `notifications` subscription; sign-out clears
// the list via the module-wired $syncSession subscription below. The list is
// server state — never persisted locally.
//
// Non-fatal by design: every network path swallows its errors (log-and-keep),
// because a broken notification feed must never break sync or the UI.

import { atom, computed } from "nanostores"
import { bffApi } from "@/lib/bff-api"
import { $syncSession } from "./sync/session"

// Known type literals per the BFF contract; unknown values are tolerated and
// render a generic fallback in the UI (the union keeps literal autocomplete).
export type NotificationType = "member.added" | "member.left" | "member.removed"

export type NotificationPayload = {
  teamId?: string
  teamName?: string
  actorUsername?: string
}

export type NotificationItem = {
  id: string
  type: NotificationType | (string & {})
  payload?: NotificationPayload
  read: boolean
  created?: string
}

export const $notifications = atom<NotificationItem[]>([])

export const $unreadCount = computed(
  $notifications,
  (items) => items.filter((item) => !item.read).length
)

// --- normalization (mirror the bff contract loosely) -------------------------

const payloadField = (raw: unknown): string | undefined =>
  typeof raw === "string" && raw.length > 0 ? raw : undefined

const normalizePayload = (raw: unknown): NotificationPayload | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const payload = raw as Record<string, unknown>
  return {
    teamId: payloadField(payload.teamId),
    teamName: payloadField(payload.teamName),
    actorUsername: payloadField(payload.actorUsername),
  }
}

const toNotificationItem = (row: {
  id: string
  type: unknown
  payload?: unknown
  read: unknown
  created?: unknown
}): NotificationItem => ({
  id: row.id,
  type: typeof row.type === "string" ? row.type : "",
  payload: normalizePayload(row.payload),
  read: Boolean(row.read),
  created: typeof row.created === "string" ? row.created : undefined,
})

// Newest first, tolerating missing/unparseable `created` (those sink last).
const byNewest = (a: NotificationItem, b: NotificationItem): number => {
  const at = a.created ? Date.parse(a.created) : Number.NaN
  const bt = b.created ? Date.parse(b.created) : Number.NaN
  if (Number.isNaN(at) || Number.isNaN(bt)) return Number.isNaN(at) ? 1 : -1
  return bt - at
}

// --- public API --------------------------------------------------------------

/**
 * Lists the signed-in user's notifications (newest first). Silent no-op when
 * signed out; on any BFF error the previous list is kept — the channel is
 * non-critical and the next connect/realtime event retries.
 */
export async function refreshNotifications(): Promise<void> {
  const session = $syncSession.get()
  if (!session) return
  try {
    const rows = await bffApi.listNotifications(session.token)
    $notifications.set(rows.map(toNotificationItem).sort(byNewest))
  } catch (error) {
    console.warn("notification refresh failed", error)
  }
}

/**
 * Marks one notification read. Optimistic: the row flips locally first so
 * the UI dims immediately, and the exact previous list is restored if the
 * PATCH fails. Silent no-op when signed out.
 */
export async function markRead(id: string): Promise<void> {
  const session = $syncSession.get()
  if (!session) return
  const previous = $notifications.get()
  $notifications.set(
    previous.map((item) => (item.id === id ? { ...item, read: true } : item))
  )
  try {
    await bffApi.markNotificationRead(session.token, id)
  } catch (error) {
    console.warn("notification mark-read failed", error)
    $notifications.set(previous)
  }
}

// Sign-out teardown (module-wired, like the engine's rotation handler): the
// list belongs to the session's user, so a null session must drop it —
// otherwise the next sign-in (possibly a different user) could briefly render
// the previous user's notifications.
$syncSession.subscribe((session) => {
  if (!session) $notifications.set([])
})
