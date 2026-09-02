// Groups service (phase 3): shared-workspace management (D1). Every call runs
// on the request-scoped PB client (the member's token) — PB's API rules are
// the authorization boundary (owner ∨ member); the BFF only shapes payloads.
import type PocketBase from "pocketbase"
import type { Group, Member, MemberInviteBody, UserPublic } from "../contracts"
import { toPublicUser } from "./auth"

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
    const result = await client.collection("groups").getFullList({
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
    const group = (await client.collection("groups").create({
      name,
      owner: userId,
    })) as unknown as Record<string, unknown>
    // The creator becomes the owner-member (schema: createRule allows it via
    // group.owner = auth.id). Non-fatal if it fails — the group itself exists.
    try {
      await client.collection("group_members").create({
        group: group.id,
        user: userId,
        role: "owner",
      })
    } catch (error) {
      console.error(
        `[groups] owner-membership create failed for ${group.id}:`,
        error
      )
    }
    return toGroup(group)
  },

  async get(client: PocketBase, id: string): Promise<Group> {
    const record = (await client
      .collection("groups")
      .getOne(id)) as unknown as Record<string, unknown>
    return toGroup(record)
  },

  // Group deletion cascades its data (schema: group-owned fields are
  // cascadeDelete) and is owner-only via the PB rule.
  async remove(client: PocketBase, id: string): Promise<void> {
    await client.collection("groups").delete(id)
  },

  async listMembers(client: PocketBase, groupId: string): Promise<Member[]> {
    const result = await client.collection("group_members").getFullList({
      filter: client.filter("group = {:groupId}", { groupId }),
      expand: "user",
      sort: "created",
    })
    return result.map((record) => {
      const expand = (record as unknown as Record<string, unknown>).expand as
        | { user?: Record<string, unknown> }
        | undefined
      const expanded = expand?.user
      const user: UserPublic = expanded
        ? toPublicUser(expanded)
        : {
            // Rule-scoped fallback: expand can be denied if the caller can't
            // view the user; members can (viewRule self), owners traverse.
            id: record.user as string,
            email: "",
            username: "",
            firstName: "",
            lastName: "",
            avatar: "",
          }
      return {
        id: record.id,
        role: record.role as Member["role"],
        group: record.group as string,
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
    const record = (await client.collection("group_members").create(
      {
        group: groupId,
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
    return {
      id: record.id as string,
      role: record.role as Member["role"],
      group: record.group as string,
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
  },

  /** Owner removes a member, or a member removes themselves (PB deleteRule). */
  async removeMember(client: PocketBase, memberId: string): Promise<void> {
    await client.collection("group_members").delete(memberId)
  },
}
