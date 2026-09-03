// Notifications service (phase 5, D4 resolved): the channel is in-app
// realtime with lifecycle events only. User-facing reads (list + mark-read)
// run on the token-scoped client; creation is system-side — `dispatch`
// writes rows through the superuser client because the events notify
// someone other than the actor and the notifications createRule is
// self-only. Types are plain text on the wire (no enum/zod — D4); current
// lifecycle literals live where they are dispatched (services/groups.ts).
import type PocketBase from "pocketbase"
import type { Notification } from "../contracts"
import { withSuperuser } from "../repositories/pocketbase"

const toNotification = (record: Record<string, unknown>): Notification => ({
  id: record.id as string,
  type: record.type as string,
  payload: record.payload as unknown,
  read: Boolean(record.read),
  user: record.user as string,
  group: (record.team as string) || undefined,
})

/**
 * Create one notification row system-side (D4 dispatch). Best-effort by
 * design: failures are logged and swallowed — notification loss is
 * acceptable, failing the primary operation is not (no dedupe key by
 * design). Runs on the superuser client (`withSuperuser`: cached singleton
 * + single-flight re-auth) because the createRule is self-only and the
 * recipient is not the actor. Exported for tests.
 */
export const dispatch = async (
  user: string,
  team: string | undefined,
  type: string,
  payload: Record<string, unknown>
): Promise<void> => {
  try {
    await withSuperuser((client) =>
      client.collection("notifications").create({ user, team, type, payload })
    )
  } catch (error) {
    console.error(
      `[notifications] dispatch failed (${type} → user ${user}):`,
      error
    )
  }
}

export const notificationsService = {
  /** Own notifications (PB listRule: user = auth.id). */
  async list(client: PocketBase): Promise<Notification[]> {
    const result = await client.collection("notifications").getFullList({
      sort: "-created",
    })
    return result.map((record) =>
      toNotification(record as unknown as Record<string, unknown>)
    )
  },

  /** Mark-read / unread (PB updateRule: user = auth.id). */
  async markRead(
    client: PocketBase,
    id: string,
    read: boolean
  ): Promise<Notification> {
    const record = (await client
      .collection("notifications")
      .update(id, { read })) as unknown as Record<string, unknown>
    return toNotification(record)
  },
}
