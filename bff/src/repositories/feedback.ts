// Feedback repository (D8): PB SDK calls for the `feedback` collection.
// Rows are write-only from the app (created here); there is no read surface
// yet — list/view/update/delete rules are superuser-only (null).

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"

/**
 * Create one feedback row on the caller's client — the shared anonymous `pb`
 * or the token-scoped client when attributed. PB's createRule admits anon
 * (`@request.auth.id = ""`) OR a row whose `user` equals the caller, so no
 * superuser path exists. `user` is included only when provided: anonymous
 * rows carry no relation.
 */
export const createFeedback = async (
  client: PocketBase,
  data: { kind: string; message: string; locale?: string; user?: string }
): Promise<Record<string, unknown>> => {
  const row: Record<string, unknown> = {
    kind: data.kind,
    message: data.message,
    locale: data.locale ?? "",
  }
  if (data.user) row.user = data.user
  return (await client
    .collection(COLLECTION_NAMES.feedback)
    .create(row)) as unknown as Record<string, unknown>
}