// Users service: authenticated exact-username lookup backing the group-invite
// flow (GET /api/users/lookup). Runs on the request-scoped PB client (D8) —
// the `users` listRule already lets any authenticated user view profiles
// (email is masked by PB; the BFF masks it in the contract too).
import type PocketBase from "pocketbase"
import type { UserPublic } from "../contracts"
import { toPublicUser } from "../lib/user"

export const usersService = {
  /**
   * Exact-match username lookup; null when no user matches (the route maps
   * that to 404). Email is always "" here — same precedent as the
   * team_member_details rows: the UserPublic contract allows an empty email.
   */
  async lookup(
    client: PocketBase,
    username: string
  ): Promise<UserPublic | null> {
    const result = await client.collection("users").getList(1, 1, {
      filter: client.filter("username = {:username}", { username }),
    })
    const record = result.items[0]
    if (!record) return null
    return toPublicUser(record as unknown as Record<string, unknown>, {
      maskEmail: true,
    })
  },
}
