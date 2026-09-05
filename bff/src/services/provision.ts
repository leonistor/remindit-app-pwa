// Team provisioning (shared by the groups service and the platform seeder).
// Creating a team is a three-part atomic-ish unit: the `teams` row, the
// owner's `team_members` row (the createRule requires owner = self), and the
// sentinel "Uncategorized" category the sync layer expects on every team.
//
// Runs against whichever client the caller scopes it to — the request token
// (groups service) or superuser (seeder) — so the semantics stay identical.

import { UNCATEGORIZED_NAME } from "@remindit/common"
import type PocketBase from "pocketbase"
import { createMember } from "../repositories/members"
import { createTeam, deleteTeam } from "../repositories/teams"

export interface ProvisionedTeam {
  team: Record<string, unknown>
  /** The sentinel category record, or null when its create was skipped. */
  sentinel: Record<string, unknown> | null
}

export async function provisionTeam(
  client: PocketBase,
  ownerId: string,
  name: string
): Promise<ProvisionedTeam> {
  const team = await createTeam(client, { name, owner: ownerId })
  const teamId = team.id as string
  try {
    await createMember(client, { team: teamId, user: ownerId, role: "owner" })
  } catch (error) {
    console.error(
      `[provision] owner-membership create failed for ${teamId}, rolling back team:`,
      error
    )
    await deleteTeam(client, teamId)
    throw new Error("failed to create team ownership — please retry")
  }
  // Sentinel (uncategorized) category — best-effort, the sync layer expects
  // every team to have one (mirrors the original groups.service behavior).
  let sentinel: Record<string, unknown> | null = null
  try {
    sentinel = (await client.collection("categories").create({
      name: UNCATEGORIZED_NAME,
      frequency: "monthly",
      team: teamId,
    })) as unknown as Record<string, unknown>
  } catch (error) {
    console.error(
      `[provision] sentinel category create failed for ${teamId}:`,
      error
    )
  }
  return { team, sentinel }
}