// Teams service (phase 3): shared-workspace management (D1). Every call runs
// on the request-scoped PB client (the member's token) — PB's API rules are
// the authorization boundary (owner ∨ member); the BFF only shapes payloads.
// NOTE: the PB collections are `teams`/`team_members` (renamed from
// groups/group_members); the public API surface stays /api/groups with the
// `Group`/`Member` contract keys unchanged.
import { UNCATEGORIZED_NAME } from "@remindit/common"
import type PocketBase from "pocketbase"
import type { Group, Member, MemberInviteBody, UserPublic } from "../contracts"
import { toPublicUser } from "./auth"
import { dispatch } from "./notifications"

const toGroup = (record: Record<string, unknown>): Group => ({
  id: record.id as string,
  name: record.name as string,
  owner: record.owner as string,
  created: record.created as string | undefined,
  updated: record.updated as string | undefined,
})

export const groupsService = {
  /** Groups the caller owns or is a member of (PB rules scope the list). */
  async list(client: PocketBase): Promise<Group[]> {
    const result = await client.collection("teams").getFullList({
      sort: "-created",
    })
    return result.map((record) =>
      toGroup(record as unknown as Record<string, unknown>)
    )
  },

  async create(
    client: PocketBase,
    userId: string,
    name: string
  ): Promise<Group> {
    const group = (await client.collection("teams").create({
      name,
      owner: userId,
    })) as unknown as Record<string, unknown>
    try {
      await client.collection("team_members").create({
        team: group.id,
        user: userId,
        role: "owner",
      })
    } catch (error) {
      console.error(
        `[groups] owner-membership create failed for ${group.id}, rolling back team:`,
        error
      )
      await client.collection("teams").delete(group.id as string)
      throw new Error("failed to create team ownership — please retry")
    }
    // Provision the sentinel (uncategorized) category — the sync layer
    // expects every team to have one.
    try {
      await client.collection("categories").create({
        name: UNCATEGORIZED_NAME,
        frequency: "monthly",
        team: group.id,
      })
    } catch (error) {
      console.error(
        `[groups] sentinel category create failed for ${group.id}:`,
        error
      )
    }
    return toGroup(group)
  },

  async get(client: PocketBase, id: string): Promise<Group> {
    const record = (await client
      .collection("teams")
      .getOne(id)) as unknown as Record<string, unknown>
    return toGroup(record)
  },

  // Group deletion cascades its data (schema: group-owned fields are
  // cascadeDelete) and is owner-only via the PB rule.
  async remove(client: PocketBase, id: string): Promise<void> {
    await client.collection("teams").delete(id)
  },

  async listMembers(client: PocketBase, teamId: string): Promise<Member[]> {
    // Pre-flight: verify the caller has access to this team (owner or member).
    // Without this, a non-member gets 200 [] instead of a 404 — inconsistent
    // with GET /:id which 404s via the PB viewRule.
    await client.collection("teams").getOne(teamId)
    // team_member_details view: memberships × public profiles pre-joined —
    // no expand chain, no fallback. The view deliberately omits email
    // (emailVisibility masking doesn't apply to view rows), so the profile
    // is built with an empty email; the UserPublic contract allows it.
    const result = await client.collection("team_member_details").getFullList({
      filter: client.filter("team = {:teamId}", { teamId }),
      sort: "joinedAt",
    })
    return result.map((record) => {
      const r = record as unknown as Record<string, unknown>
      const user: UserPublic = {
        id: r.userId as string,
        email: "",
        username: r.username as string,
        firstName: r.firstName as string,
        lastName: r.lastName as string,
        avatar: r.avatar as string,
      }
      return {
        id: r.id as string,
        role: r.role as Member["role"],
        group: r.team as string,
        user,
      }
    })
  },

  /** Owner-only (PB createRule evaluates the hydrated group). */
  async invite(
    client: PocketBase,
    groupId: string,
    body: MemberInviteBody
  ): Promise<Member> {
    const record = (    await client.collection("team_members").create(
      {
        team: groupId,
        user: body.userId,
        role: body.role,
      },
      // `expand` must ride the QUERY string — in the body PB ignores it.
      { query: { expand: "user" } }
    )) as unknown as Record<string, unknown>
    const expand = record.expand as
      | { user?: Record<string, unknown> }
      | undefined
    const expanded = expand?.user
    const member: Member = {
      id: record.id as string,
      role: record.role as Member["role"],
      group: record.team as string,
      user: expanded
        ? toPublicUser(expanded)
        : {
            id: body.userId,
            email: "",
            username: "",
            firstName: "",
            lastName: "",
            avatar: "",
          },
    }
    // Lifecycle notification (D4): the ADDED user learns they joined. The
    // team name and the actor's username are fetched on the request-scoped
    // client (teams viewRule: owner ∨ member — the inviting owner passes;
    // users viewRule: any authenticated user; auth-refresh also yields the
    // caller's record without changing the route signature); the row itself
    // is written superuser-side inside dispatch. Best-effort — a failure
    // here never fails the invite.
    try {
      const [team, actor] = await Promise.all([
        client.collection("teams").getOne(groupId),
        client.collection("users").authRefresh(),
      ])
      const t = team as unknown as Record<string, unknown>
      const a = actor.record as unknown as Record<string, unknown>
      await dispatch(body.userId, groupId, "member.added", {
        teamId: groupId,
        teamName: t.name as string,
        actorUsername: a.username as string,
      })
    } catch (error) {
      console.error("[notifications] dispatch failed (member.added):", error)
    }
    return member
  },

  /** Owner removes a member, or a member removes themselves (PB deleteRule). */
  async removeMember(client: PocketBase, memberId: string): Promise<void> {
    // Pre-fetch everything the dispatch needs BEFORE the delete: the
    // membership (viewRule: the member themself ∨ the team owner — exactly
    // the actors allowed to delete) tells a self-leave from a removal and
    // names the recipient; the team record and the actor's identity must
    // also be read while the actor still has access (a departed member can
    // no longer read the team — teams viewRule is owner ∨ member). A denied
    // read 404s like the old blind delete did, so the error surface is
    // unchanged.
    const membership = (await client
      .collection("team_members")
      .getOne(memberId)) as unknown as Record<string, unknown>
    const targetUser = membership.user as string
    const teamId = membership.team as string
    const [team, actor] = await Promise.all([
      client.collection("teams").getOne(teamId),
      client.collection("users").authRefresh(),
    ])
    await client.collection("team_members").delete(memberId)
    // Lifecycle notification (D4): a self-leave notifies the OWNER, a
    // removal notifies the REMOVED user. Same best-effort contract as
    // invite() — never fails the removal.
    try {
      const t = team as unknown as Record<string, unknown>
      const a = actor.record as unknown as Record<string, unknown>
      const selfLeft = (a.id as string) === targetUser
      await dispatch(
        selfLeft ? (t.owner as string) : targetUser,
        teamId,
        selfLeft ? "member.left" : "member.removed",
        {
          teamId,
          teamName: t.name as string,
          actorUsername: a.username as string,
        }
      )
    } catch (error) {
      console.error(
        "[notifications] dispatch failed (membership removal):",
        error
      )
    }
  },
}
