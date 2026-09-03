// Admin service (phase 6): cross-tenant reads + mutations, executed
// superuser-side. Authorization is two-layered — the routes reject non-admin
// callers (role from the validated session record) and every query here runs
// as superuser because regular rules deliberately scope users to themselves.

import type {
  AdminGroup,
  AdminOverview,
  AdminUser,
  AdminUserCreateBody,
} from "../contracts"
import { withSuperuser } from "../repositories/pocketbase"

const stamps = (record: Record<string, unknown>) => ({
  created: record.created as string | undefined,
  updated: record.updated as string | undefined,
})

export const adminService = {
  async overview(): Promise<AdminOverview> {
    // Single-row platform_stats view — one query instead of five perPage-1
    // metadata pokes. Contract keys stay groups-named; the view's team
    // counter is aliased `teams`.
    const { items } = await withSuperuser((admin) =>
      admin.collection("platform_stats").getList(1, 1)
    )
    const row = items[0] as unknown as Record<string, number>
    if (!row)
      return {
        users: 0,
        groups: 0,
        items: 0,
        listEntries: 0,
        historyEvents: 0,
      }
    return {
      users: row.users,
      groups: row.teams,
      items: row.items,
      listEntries: row.listEntries,
      historyEvents: row.historyEvents,
    }
  },

  async listUsers(
    page = 1,
    perPage = 50,
    /** Optional PB filter — lets callers scope the page (e.g. by username). */
    filter?: string
  ): Promise<{
    items: AdminUser[]
    total: number
  }> {
    // NOTE: no sort — auth collections have no created/updated autodate
    // fields in PB 0.40 and sorting on them 400s.
    const result = await withSuperuser((admin) =>
      admin.collection("users").getList(page, perPage, {
        filter,
      })
    )
    return {
      items: result.items.map((record) => {
        const r = record as unknown as Record<string, unknown>
        return {
          id: r.id as string,
          email: (r.email as string) ?? "",
          username: (r.username as string) ?? "",
          firstName: (r.firstName as string) ?? "",
          lastName: (r.lastName as string) ?? "",
          avatar: (r.avatar as string) ?? "",
          role: r.role === "admin" ? "admin" : "user",
          ...stamps(r),
        }
      }),
      total: result.totalItems,
    }
  },

  async createUser(body: AdminUserCreateBody): Promise<AdminUser> {
    const record = (await withSuperuser((admin) =>
      admin.collection("users").create({
        email: body.email,
        password: body.password,
        passwordConfirm: body.password,
        username: body.username,
        role: body.role,
        firstName: body.firstName ?? "",
        lastName: body.lastName ?? "",
        avatar: "",
      })
    )) as unknown as Record<string, unknown>
    return {
      id: record.id as string,
      email: (record.email as string) ?? "",
      username: (record.username as string) ?? "",
      firstName: (record.firstName as string) ?? "",
      lastName: (record.lastName as string) ?? "",
      avatar: (record.avatar as string) ?? "",
      role: record.role === "admin" ? "admin" : "user",
      ...stamps(record),
    }
  },

  async deleteUser(id: string): Promise<void> {
    await withSuperuser(async (admin) => {
      const ownedTeams = await admin.collection("teams").getFullList({
        filter: admin.filter("owner = {:userId}", { userId: id }),
      })
      if (ownedTeams.length > 0) {
        throw new Error(
          `User owns ${ownedTeams.length} team(s). Reassign or delete them first.`
        )
      }
      await admin.collection("users").delete(id)
    })
  },

  async listGroups(): Promise<AdminGroup[]> {
    // team_details view: ownerUsername + membersCount pre-joined by the
    // schema — no two-fetch + JS-map join. (PB collections are
    // teams/team_members; AdminGroup keys unchanged.)
    const teams = await withSuperuser((admin) =>
      admin.collection("team_details").getFullList({
        sort: "-created",
      })
    )
    return teams.map((record) => {
      const r = record as unknown as Record<string, unknown>
      return {
        id: r.id as string,
        name: r.name as string,
        owner: r.owner as string,
        ownerUsername: (r.ownerUsername as string) || undefined,
        membersCount: (r.membersCount as number) ?? 0,
        ...stamps(r),
      }
    })
  },

  async deleteGroup(id: string): Promise<void> {
    await withSuperuser((admin) => admin.collection("teams").delete(id))
  },
}
