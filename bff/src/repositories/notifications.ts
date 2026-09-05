// Notifications repository (D8): PB SDK calls for the `notifications`
// collection. User-facing reads run on the token-scoped client (PB rules:
// list/update self-only); system-side creation runs superuser-side via
// `withSuperuser` (the createRule is self-only and the recipient is not the
// actor).

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"
import { withSuperuser } from "./pocketbase"

/** The caller's notifications (PB listRule: user = auth.id). */
export const listNotifications = async (
  client: PocketBase
): Promise<Record<string, unknown>[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.notifications)
    .getList(1, 500, { sort: "-created" })
  return result.items as unknown as Record<string, unknown>[]
}

/** Mark-read / unread (PB updateRule: user = auth.id). */
export const updateNotification = async (
  client: PocketBase,
  id: string,
  read: boolean
): Promise<Record<string, unknown>> =>
  (await client
    .collection(COLLECTION_NAMES.notifications)
    .update(id, { read })) as unknown as Record<string, unknown>

/**
 * Create one notification row system-side (D4 dispatch). Best-effort by
 * design: failures are logged and swallowed by the caller — notification
 * loss is acceptable, failing the primary operation is not. Runs on the
 * superuser client because the createRule is self-only and the recipient is
 * not the actor.
 */
export const createNotificationSuperuser = async (
  data: {
    user: string
    team: string | undefined
    type: string
    payload: Record<string, unknown>
  }
): Promise<void> => {
  await withSuperuser((client) =>
    client
      .collection(COLLECTION_NAMES.notifications)
      .create({ user: data.user, team: data.team ?? "", type: data.type, payload: data.payload })
  )
}