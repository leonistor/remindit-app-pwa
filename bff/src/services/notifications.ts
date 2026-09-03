// Notifications service (phase 3 stub, D4): the channel is undecided — only
// list + mark-read are exposed so the client contract exists. Dispatch lands
// in phase 5+ once the channel is chosen.
import type PocketBase from "pocketbase"
import type { Notification } from "../contracts"

const toNotification = (record: Record<string, unknown>): Notification => ({
  id: record.id as string,
  type: record.type as string,
  payload: record.payload as unknown,
  read: Boolean(record.read),
  user: record.user as string,
  group: (record.team as string) || undefined,
})

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
