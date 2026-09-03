// Integration tests for the phase-6 admin routes — live PB required
// (skipped otherwise). The admin fixture is created superuser-side with
// role=admin; a regular registered user must be rejected with 403.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import type { ZodType } from "zod"
import { type AppType, app } from "../src/app"
import {
  adminOverviewSchema,
  adminUserPageSchema,
  userPublicSchema,
} from "../src/contracts"
import { env } from "../src/env"
import { forSuperuser } from "../src/repositories/pocketbase"

const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))

const base = `http://127.0.0.1:${server.port}`
const client = hc<AppType>(base)

const contract = async <T>(
  response: { json(): Promise<unknown> },
  schema: ZodType<T>
): Promise<T> => schema.parse(await response.json())

const pbUp = await fetch(`${env.pocketbaseUrl}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)
const describeIfPb = pbUp ? describe : describe.skip

const run = Date.now().toString(36)
const password = process.env.TEST_PASSWORD ?? "secret12345"

describeIfPb("admin API (live)", () => {
  let adminToken: string
  let adminId: string
  let regularToken: string
  // Users created by the tests below — deleted inline on the happy path; the
  // afterAll net only catches partial failures (already-deleted ids 404).
  const fixtureUserIds: string[] = []

  beforeAll(async () => {
    // Fixture: register a regular user, then superuser-promote them to admin.
    const registered = await client.api.auth.register.$post({
      json: {
        email: `adm-${run}@test.local`,
        password,
        passwordConfirm: password,
        username: `adm-${run}`,
      },
    })
    const user = (await registered.json()) as { user: { id: string } }
    adminId = user.user.id
    const admin = await forSuperuser()
    await admin.collection("users").update(adminId, { role: "admin" })
    const login = await client.api.auth.login.$post({
      json: { email: `adm-${run}@test.local`, password },
    })
    adminToken = ((await login.json()) as { token: string }).token

    const regular = await client.api.auth.register.$post({
      json: {
        email: `reg-${run}@test.local`,
        password,
        passwordConfirm: password,
        username: `reg-${run}`,
      },
    })
    regularToken = ((await regular.json()) as { token: string }).token
  })

  const authOptions = (token: string) => ({
    headers: { authorization: `Bearer ${token}` },
  })

  test("non-admin callers are rejected with 403 before any query", async () => {
    const res = await client.api.admin.overview.$get(
      undefined,
      authOptions(regularToken)
    )
    expect(res.status).toBe(403)
    // hono RPC types only route-handler responses — the 403 body comes from
    // the requireAdmin middleware, so it's invisible to the client type.
    const body = (await res.json()) as unknown as { error: string }
    expect(body.error).toBe("admin role required")
  })

  test("overview counts (superuser-side)", async () => {
    const res = await client.api.admin.overview.$get(
      undefined,
      authOptions(adminToken)
    )
    expect(res.status).toBe(200)
    const overview = await contract(res, adminOverviewSchema)
    // The two registrations in this file's beforeAll + earlier suites.
    expect(overview.users).toBeGreaterThanOrEqual(2)
  })

  test("users list includes email + role (admin-only fields)", async () => {
    // Scope to the fixture: the instance accumulates users across runs, so a
    // bare page cannot be assumed to contain the newest records.
    const res = await client.api.admin.users.$get(
      { query: { filter: `username = "adm-${run}"` } },
      authOptions(adminToken)
    )
    expect(res.status).toBe(200)
    const page = await contract(res, adminUserPageSchema)
    const me = page.items.find((u) => u.id === adminId)
    expect(me?.role).toBe("admin")
    expect(me?.email).toBe(`adm-${run}@test.local`)
  })

  test("create user (registration flow) then delete", async () => {
    const created = await client.api.admin.users.$post(
      {
        json: {
          email: `created-${run}@test.local`,
          password,
          username: `created-${run}`,
          role: "user",
        },
      },
      authOptions(adminToken)
    )
    expect(created.status).toBe(201)
    const createdUser = await contract(created, userPublicSchema)
    expect(createdUser.role).toBe("user")

    const deleted = await client.api.admin.users[":id"].$delete(
      { param: { id: createdUser.id } },
      authOptions(adminToken)
    )
    expect(deleted.status).toBe(204)
  })

  test("admin cannot delete their own account", async () => {
    const res = await client.api.admin.users[":id"].$delete(
      { param: { id: adminId } },
      authOptions(adminToken)
    )
    expect(res.status).toBe(400)
  })

  test("groups list carries member counts", async () => {
    const res = await client.api.admin.groups.$get(
      undefined,
      authOptions(adminToken)
    )
    expect(res.status).toBe(200)
    const groups = (await res.json()) as Array<{ membersCount: number }>
    expect(Array.isArray(groups)).toBe(true)
  })

  afterAll(async () => {
    if (!pbUp) return
    const admin = await forSuperuser()
    for (const id of fixtureUserIds) {
      await admin
        .collection("users")
        .delete(id)
        .catch(() => {})
    }
  })

  test("non-admin cannot create users (mutating verb is admin-guarded too)", async () => {
    // Raw fetch: the requireAdmin 403 is produced by middleware, outside the
    // RPC client's response-type union (201 | 400).
    const res = await fetch(`${base}/api/admin/users`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${regularToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: `nope-${run}@test.local`,
        password,
        username: `nope-${run}`,
        role: "user",
      }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as unknown as { error: string }
    expect(body.error).toBe("admin role required")
  })

  test("admin can mint another admin; role escalation works end-to-end", async () => {
    const created = await client.api.admin.users.$post(
      {
        json: {
          email: `escal-${run}@test.local`,
          password,
          username: `escal-${run}`,
          role: "admin",
        },
      },
      authOptions(adminToken)
    )
    expect(created.status).toBe(201)
    const createdAdmin = await contract(created, userPublicSchema)
    expect(createdAdmin.role).toBe("admin")
    fixtureUserIds.push(createdAdmin.id)

    // The new admin's own session can call an admin endpoint — the role is
    // real server-side, not just a field echoed back.
    const login = await client.api.auth.login.$post({
      json: { email: `escal-${run}@test.local`, password },
    })
    const escalatedToken = ((await login.json()) as { token: string }).token
    const overview = await client.api.admin.overview.$get(
      undefined,
      authOptions(escalatedToken)
    )
    expect(overview.status).toBe(200)

    const deleted = await client.api.admin.users[":id"].$delete(
      { param: { id: createdAdmin.id } },
      authOptions(adminToken)
    )
    expect(deleted.status).toBe(204)
  })

  test("DELETE /api/admin/groups/:id removes the group (204, gone from the list)", async () => {
    // Fixture: a group owned by the admin user (created via the user-facing
    // route, which the admin may call — owner = self).
    const created = await client.api.groups.$post(
      { json: { name: `adm-group-${run}` } },
      authOptions(adminToken)
    )
    expect(created.status).toBe(201)
    const groupId = ((await created.json()) as { id: string }).id

    const deleted = await client.api.admin.groups[":id"].$delete(
      { param: { id: groupId } },
      authOptions(adminToken)
    )
    expect(deleted.status).toBe(204)

    // Gone: admin list is a superuser-side full list, so a find on the exact
    // id is a complete check (no pagination to reason about).
    const list = await client.api.admin.groups.$get(
      undefined,
      authOptions(adminToken)
    )
    expect(list.status).toBe(200)
    const groups = (await list.json()) as Array<{ id: string }>
    expect(groups.find((g) => g.id === groupId)).toBeUndefined()
  })

  test("DELETE /api/admin/groups/:id with an unknown id surfaces PB's 404", async () => {
    // Raw fetch: PB's 404 (mapped by app.onError) is outside the RPC client's
    // response-type union (204). Well-formed 15-char id that no record has.
    const res = await fetch(`${base}/api/admin/groups/zzzzzzzzzzzzzzz`, {
      method: "DELETE",
      headers: authOptions(adminToken).headers,
    })
    expect(res.status).toBe(404)
  })
})
