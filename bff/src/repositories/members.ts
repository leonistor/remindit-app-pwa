// Team-members repository (D8): PB SDK calls for `team_members` (membership
// rows) and the `team_member_details` view (memberships × public profiles).
// Scoped to the caller-supplied client so PB rules stay the authorization
// boundary.

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"

/** Memberships × profiles for a team (view rows; PB viewRule scopes them). */
export const listTeamMemberDetails = async (
  client: PocketBase,
  teamId: string
): Promise<Record<string, unknown>[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.teamMemberDetails)
    .getFullList({
      filter: client.filter("team = {:teamId}", { teamId }),
      sort: "joinedAt",
    })
  return result as unknown as Record<string, unknown>[]
}

export const createMember = async (
  client: PocketBase,
  data: { team: string; user: string; role: string },
  opts?: { expandUser?: boolean }
): Promise<Record<string, unknown>> =>
  (await client.collection(COLLECTION_NAMES.teamMembers).create(
    data,
    // `expand` must ride the QUERY string — in the body PB ignores it.
    opts?.expandUser ? { query: { expand: "user" } } : undefined
  )) as unknown as Record<string, unknown>

export const getMember = async (
  client: PocketBase,
  memberId: string
): Promise<Record<string, unknown>> =>
  (await client
    .collection(COLLECTION_NAMES.teamMembers)
    .getOne(memberId)) as unknown as Record<string, unknown>

export const deleteMember = async (
  client: PocketBase,
  memberId: string
): Promise<void> => {
  await client.collection(COLLECTION_NAMES.teamMembers).delete(memberId)
}