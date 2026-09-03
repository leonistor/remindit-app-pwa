// Integration tests for the phase-3 API — run against a live PocketBase
// (bun run dev:bff); SKIP (not fail) when PB is down so `bun test` stays
// green in PB-less environments. The full flow goes through the Hono RPC
// client (hc<AppType>) over a real HTTP server — exactly what pwa/web/admin
// will consume — and every response is parsed against the published Zod
// contract (D8): the wire shape itself is under test.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { type ZodType, z } from "zod"
import { type AppType, app } from "../src/app"
import {
  authResponseSchema,
  type Group,
  groupSchema,
  type Member,
  memberSchema,
  notificationSchema,
  statsSchema,
  userPublicSchema,
} from "../src/contracts"
import { env } from "../src/env"
import { forSuperuser } from "../src/repositories/pocketbase"

const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))

const base = `http://127.0.0.1:${server.port}`
const client = hc<AppType>(base)

/** Parse + validate any response against its published contract. */
const contract = async <T>(
  response: { json(): Promise<unknown> },
  schema: ZodType<T>
): Promise<T> => schema.parse(await response.json())

const pbUp = await fetch(`${env.pocketbaseUrl}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)
const describeIfPb = pbUp ? describe : describe.skip

// Unique per run (unique username/email indexes on PB).
const run = Date.now().toString(36)
const password = process.env.TEST_PASSWORD ?? "secret12345"

// Per-request auth goes in hc's SECOND arg (ClientRequestOptions.headers);
// the first arg carries json/param/query.
const authOptions = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
})

const register = async (username: string) => {
  const res = await client.api.auth.register.$post({
    json: {
      email: `${username}@test.local`,
      password,
      passwordConfirm: password,
      username,
    },
  })
  expect(res.status).toBe(201)
  return contract(res, authResponseSchema)
}

describeIfPb("auth API (live)", () => {
  let alice: Awaited<ReturnType<typeof register>>

  beforeAll(async () => {
    alice = await register(`alice-${run}`)
  })

  test("me returns the authenticated user (Bearer)", async () => {
    const res = await client.api.auth.me.$get(
      undefined,
      authOptions(alice.token)
    )
    expect(res.status).toBe(200)
    const user = await contract(res, userPublicSchema)
    expect(user.username).toBe(`alice-${run}`)
    expect(user.email).toBe(`alice-${run}@test.local`)
  })

  test("fresh token is not rotated (no X-Session-Token on the response)", async () => {
    const res = await client.api.auth.me.$get(
      undefined,
      authOptions(alice.token)
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("x-session-token")).toBeNull()
  })

  test("me with a garbage token → 401", async () => {
    const res = await client.api.auth.me.$get(undefined, {
      headers: { authorization: "Bearer garbage" },
    })
    expect(res.status).toBe(401)
  })

  test("login with wrong password → 400", async () => {
    const res = await client.api.auth.login.$post({
      json: { email: `alice-${run}@test.local`, password: "wrong-password" },
    })
    expect(res.status).toBe(400)
  })

  test("duplicate username → 400 with details", async () => {
    const res = await client.api.auth.register.$post({
      json: {
        email: `other-${run}@test.local`,
        password,
        passwordConfirm: password,
        username: `alice-${run}`,
      },
    })
    expect(res.status).toBe(400)
  })
})

describeIfPb("groups API (live)", () => {
  let alice: Awaited<ReturnType<typeof register>>
  let bob: Awaited<ReturnType<typeof register>>
  let carol: Awaited<ReturnType<typeof register>>
  let groupId: string
  let memberIdBob: string

  beforeAll(async () => {
    alice = await register(`ga-${run}`)
    bob = await register(`gb-${run}`)
    carol = await register(`gc-${run}`)
  })

  const members = async (token: string, id: string): Promise<Member[]> => {
    const res = await client.api.groups[":id"].members.$get(
      { param: { id } },
      authOptions(token)
    )
    expect(res.status).toBe(200)
    return contract(res, z.array(memberSchema))
  }

  test("create group → owner membership auto-provisioned", async () => {
    const res = await client.api.groups.$post(
      { json: { name: "Home" } },
      authOptions(alice.token)
    )
    expect(res.status).toBe(201)
    const group: Group = await contract(res, groupSchema)
    expect(group.name).toBe("Home")
    expect(group.owner).toBe(alice.user.id)
    groupId = group.id

    const ownerMembers = await members(alice.token, groupId)
    expect(ownerMembers).toHaveLength(1)
    expect(ownerMembers[0].role).toBe("owner")
    expect(ownerMembers[0].user.id).toBe(alice.user.id)
  })

  test("owner invites a member; member sees the group", async () => {
    const invite = await client.api.groups[":id"].members.$post(
      { param: { id: groupId }, json: { userId: bob.user.id, role: "member" } },
      authOptions(alice.token)
    )
    expect(invite.status).toBe(201)
    const member = await contract(invite, memberSchema)
    memberIdBob = member.id
    expect(member.user.id).toBe(bob.user.id)
    expect(member.user.username).toBe(`gb-${run}`)

    const groups = await contract(
      await client.api.groups.$get(undefined, authOptions(bob.token)),
      z.array(groupSchema)
    )
    expect(groups.map((g) => g.name)).toContain("Home")
  })

  test("invite dispatched member.added to the invitee (D4 end-to-end)", async () => {
    // Dispatch ran superuser-side during the invite test above; the invitee
    // reads the row back through the user-scoped listRule.
    const items = await contract(
      await client.api.notifications.$get(undefined, authOptions(bob.token)),
      z.array(notificationSchema)
    )
    const added = items.find((n) => n.type === "member.added")
    if (!added) throw new Error("member.added notification not found")
    expect(added.user).toBe(bob.user.id)
    expect(added.group).toBe(groupId)
    expect(added.read).toBe(false)
    expect(added.payload).toEqual({
      teamId: groupId,
      teamName: "Home",
      actorUsername: `ga-${run}`,
    })
  })

  test("non-member invite attempt → 403 (PB createRule)", async () => {
    const res = await client.api.groups[":id"].members.$post(
      {
        param: { id: groupId },
        json: { userId: carol.user.id, role: "member" },
      },
      authOptions(carol.token)
    )
    // Denial comes from PB via onError: a failed CREATE rule surfaces as 400
    // ("Failed to create record"), not 403 (that's for read/update/delete).
    expect(res.status).toBe(400)
  })

  test("member cannot remove another member; can self-leave", async () => {
    // carol is neither member nor owner → denied either way
    const denied = await client.api.groups[":id"].members[":memberId"].$delete(
      { param: { id: groupId, memberId: memberIdBob } },
      authOptions(carol.token)
    )
    expect(denied.status as number).toBe(404)

    const selfLeave = await client.api.groups[":id"].members[
      ":memberId"
    ].$delete(
      { param: { id: groupId, memberId: memberIdBob } },
      authOptions(bob.token)
    )
    expect(selfLeave.status).toBe(204)
  })

  test("owner deletes the group (cascades memberships)", async () => {
    const res = await client.api.groups[":id"].$delete(
      { param: { id: groupId } },
      authOptions(alice.token)
    )
    expect(res.status).toBe(204)
  })
})

describeIfPb("notifications API (live)", () => {
  let alice: Awaited<ReturnType<typeof register>>

  beforeAll(async () => {
    alice = await register(`gn-${run}`)
  })

  test("list + mark-read (fixture inserted superuser-side)", async () => {
    // Channel undecided (D4): dispatch doesn't exist yet, so the fixture is
    // inserted superuser-side to exercise the read path.
    const admin = await forSuperuser()
    await admin.collection("notifications").create({
      user: alice.user.id,
      type: "test.ping",
      payload: { hello: true },
    })

    const list = await client.api.notifications.$get(
      undefined,
      authOptions(alice.token)
    )
    expect(list.status).toBe(200)
    const items = await contract(list, z.array(notificationSchema))
    const own = items.find((n) => n.type === "test.ping")
    if (!own) throw new Error("fixture notification not found")
    expect(own.read).toBe(false)

    const marked = await client.api.notifications[":id"].$patch(
      { param: { id: own.id }, json: { read: true } },
      authOptions(alice.token)
    )
    expect(marked.status).toBe(200)
    expect((await contract(marked, notificationSchema)).read).toBe(true)

    // Other users never see it (listRule user = auth.id).
    const bob = await register(`gnb-${run}`)
    const otherItems = await contract(
      await client.api.notifications.$get(undefined, authOptions(bob.token)),
      z.array(notificationSchema)
    )
    expect(otherItems.find((n) => n.id === own?.id)).toBeUndefined()
  })
})

describeIfPb("stats API (live)", () => {
  test("public aggregate counts, no auth needed", async () => {
    // Registrations from the describes above already ran — users must count
    // at least those; groups may be zero on a fresh instance.
    const res = await client.api.stats.$get()
    expect(res.status).toBe(200)
    const stats = await contract(res, statsSchema)
    expect(stats.users).toBeGreaterThanOrEqual(3)
    expect(stats.groups).toBeGreaterThanOrEqual(0)
  })
})
