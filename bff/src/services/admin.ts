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
import { forSuperuser } from "../repositories/pocketbase"

const stamps = (record: Record<string, unknown>) => ({
  created: record.created as string | undefined,
  updated: record.updated as string | undefined,
})

export const adminService = {
  async overview(): Promise<AdminOverview> {
    const admin = await forSuperuser()
    const collections = [
      "users",
      "groups",
      "items",
      "list_entries",
      "history_events",
    ] as const
    const results = await Promise.all(
      collections.map((name) => admin.collection(name).getList(1, 1))
    )
    const [users, groups, items, listEntries, historyEvents] = results.map(
      (r) => r.totalItems
    )
    return { users, groups, items, listEntries, historyEvents }
  },

  async listUsers(page = 1, perPage = 50): Promise<{
    items: AdminUser[]
    total: number
  }> {
    const admin = await forSuperuser()
    // NOTE: no sort — auth collections have no created/updated autodate
    // fields in PB 0.40 and sorting on them 400s.
    const result = await admin.collection("users").getList(page, perPage)
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
    const admin = await forSuperuser()
    const record = (await admin.collection("users").create({
      email: body.email,
      password: body.password,
      passwordConfirm: body.password,
      username: body.username,
      role: body.role,
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      avatar: "",
    })) as unknown as Record<string, unknown>
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
    const admin = await forSuperuser()
    await admin.collection("users").delete(id)
  },

  async listGroups(): Promise<AdminGroup[]> {
    const admin = await forSuperuser()
    const [groups, memberships] = await Promise.all([
      admin.collection("groups").getFullList({ sort: "-created" }),
      admin.collection("group_members").getFullList({ expand: "user" }),
    ])
    const ownerUsernames = new Map<string, string>()
    for (const membership of memberships) {
      const r = membership as unknown as Record<string, unknown>
      if (r.role === "owner") {
        const expand = r.expand as { user?: Record<string, unknown> } | undefined
        const user = expand?.user
        if (user) ownerUsernames.set(r.group as string, user.username as string)
      }
    }
    const counts = new Map<string, number>()
    for (const membership of memberships) {
      const r = membership as unknown as Record<string, unknown>
      counts.set(r.group as string, (counts.get(r.group as string) ?? 0) + 1)
    }
    return groups.map((record) => {
      const r = record as unknown as Record<string, unknown>
      return {
        id: r.id as string,
        name: r.name as string,
        owner: r.owner as string,
        ownerUsername: ownerUsernames.get(r.id as string),
        membersCount: counts.get(r.id as string) ?? 0,
        ...stamps(r),
      }
    })
  },

  async deleteGroup(id: string): Promise<void> {
    const admin = await forSuperuser()
    await admin.collection("groups").delete(id)
  },
}
