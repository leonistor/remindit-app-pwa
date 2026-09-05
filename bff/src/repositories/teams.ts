// Teams collection repository (D8): PB SDK calls for the `teams` collection,
// scoped to whichever client the caller supplies (request token for user ops,
// superuser for system writes) so PB's API rules stay the authorization
// boundary. Services never import the SDK collection name directly.

import type PocketBase from "pocketbase"
import { COLLECTION_NAMES } from "../schema/collections"

/** List the teams the caller can see (PB rules scope the rows). */
export const listTeams = async (
  client: PocketBase
): Promise<Record<string, unknown>[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.teams)
    .getList(1, 200, { sort: "-created" })
  return result.items as unknown as Record<string, unknown>[]
}

export const getTeam = async (
  client: PocketBase,
  id: string
): Promise<Record<string, unknown>> =>
  (await client
    .collection(COLLECTION_NAMES.teams)
    .getOne(id)) as unknown as Record<string, unknown>

export const createTeam = async (
  client: PocketBase,
  data: { name: string; owner: string }
): Promise<Record<string, unknown>> =>
  (await client
    .collection(COLLECTION_NAMES.teams)
    .create(data)) as unknown as Record<string, unknown>

export const deleteTeam = async (
  client: PocketBase,
  id: string
): Promise<void> => {
  await client.collection(COLLECTION_NAMES.teams).delete(id)
}

/** Teams owned by a user (admin guard: block deleting an owning user). */
export const listTeamsByOwner = async (
  client: PocketBase,
  ownerId: string
): Promise<Record<string, unknown>[]> => {
  const result = await client
    .collection(COLLECTION_NAMES.teams)
    .getFullList({
      filter: client.filter("owner = {:ownerId}", { ownerId }),
    })
  return result as unknown as Record<string, unknown>[]
}