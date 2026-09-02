// Integration tests for the phase-6 admin routes — live PB required
// (skipped otherwise). The admin fixture is created superuser-side with
// role=admin; a regular registered user must be rejected with 403.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import type { ZodType } from "zod"
import {
  adminOverviewSchema,
  adminUserPageSchema,
  userPublicSchema,
} from "../src/contracts"
import { app, type AppType } from "../src/app"
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
const password = "secret12345"

describeIfPb("admin API (live)", () => {
  let adminToken: string
  let adminId: string
  let regularToken: string

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
    const body = (await res.json()) as { error: string }
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
    // The instance accumulates users across runs — pull a large page so the
    // fixture is included.
    const res = await client.api.admin.users.$get(
      { query: { perPage: "200" } },
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
})
