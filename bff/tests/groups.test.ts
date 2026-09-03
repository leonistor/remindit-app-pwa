// Groups service lifecycle-notification dispatch (D4) — unit paths run
// unconditionally with the PocketBase SDK's collection() stubbed on the
// prototype (the superuser.test.ts convention): the real clients, the
// cached superuser singleton and its single-flight auth all run, but no
// HTTP happens. The live end-to-end dispatch assertion lives in
// api.integration.test.ts (skips when PB is down).

import { afterAll, beforeAll, describe, expect, mock, spyOn, test } from "bun:test"
import PocketBase, { ClientResponseError } from "pocketbase"
import { memberSchema } from "../src/contracts"
import { forSuperuser, forToken } from "../src/repositories/pocketbase"
import { groupsService } from "../src/services/groups"

// Fixtures — only the rows the dispatch flows touch.
const alice = {
  id: "u-alice",
  username: "alice",
  email: "alice@test.local",
  firstName: "Alice",
  lastName: "",
  avatar: "",
}
const bob = {
  id: "u-bob",
  username: "bob",
  email: "bob@test.local",
  firstName: "Bob",
  lastName: "",
  avatar: "",
}
const team = { id: "t1", name: "Home", owner: "u-alice" }
const membershipBob = { id: "m-bob", team: "t1", user: "u-bob", role: "member" }

type Dispatched = {
  user: string
  team: string | undefined
  type: string
  payload: unknown
}

// Mutable per-test knobs, read by the collection() replacement below.
const state = {
  /** Record auth-refresh returns — the calling user (actor). */
  caller: alice as { id: string; username: string },
  /** Make the notifications create fail (dispatch must swallow it). */
  failNotifications: false,
  dispatched: [] as Dispatched[],
}

// A well-formed JWT with a future exp — authStore.isValid decodes the
// payload, so a dummy string would never count as authenticated.
const futureToken = () =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.s`

let superuserClient: PocketBase

beforeAll(async () => {
  spyOn(PocketBase.prototype, "collection").mockImplementation(
    function (this: PocketBase, name: string) {
      return {
        // Superuser singleton auth — persists the session like the SDK.
        authWithPassword: async () => {
          this.authStore.save(futureToken(), { id: "superuser" } as never)
        },
        // Request-scoped caller identity (actor username/id).
        authRefresh: async () => {
          this.authStore.save(futureToken(), state.caller as never)
          return { token: futureToken(), record: state.caller }
        },
        getOne: async () => {
          if (name === "teams") return { ...team }
          if (name === "team_members") return { ...membershipBob }
          throw new ClientResponseError({ status: 404, response: { code: 404 } })
        },
        create: async (data: Record<string, unknown>) => {
          if (name === "notifications") {
            if (state.failNotifications) {
              throw new ClientResponseError({
                status: 400,
                response: { code: 400, message: "Failed to create record." },
              })
            }
            state.dispatched.push({
              user: data.user as string,
              team: data.team as string | undefined,
              type: data.type as string,
              payload: data.payload,
            })
            return { id: `n-${state.dispatched.length}`, read: false, ...data }
          }
          // team_members create (invite) — expand.user rides the query.
          return { ...membershipBob, expand: { user: bob } }
        },
        delete: async () => true,
      } as never
    } as never
  )
  superuserClient = await forSuperuser()
})

afterAll(() => {
  // Don't leak the stubbed superuser session to later test files.
  superuserClient.authStore.clear()
  mock.restore()
})

describe("groups notifications dispatch (stubbed PB)", () => {
  test("invite dispatches member.added to the invitee with team + actor payload", async () => {
    state.dispatched = []
    state.caller = alice
    const member = await groupsService.invite(forToken(futureToken()), "t1", {
      userId: bob.id,
      role: "member",
    })
    // The primary op still returns the contract shape…
    expect(memberSchema.parse(member).user.id).toBe(bob.id)
    // …and exactly one dispatch row landed for the invitee.
    expect(state.dispatched).toHaveLength(1)
    const n = state.dispatched[0]
    expect(n.type).toBe("member.added")
    expect(n.user).toBe(bob.id)
    expect(n.team).toBe("t1")
    expect(n.payload).toEqual({
      teamId: "t1",
      teamName: "Home",
      actorUsername: "alice",
    })
  })

  test("owner removing a member dispatches member.removed to the removed user", async () => {
    state.dispatched = []
    state.caller = alice
    await groupsService.removeMember(forToken(futureToken()), "m-bob")
    expect(state.dispatched).toHaveLength(1)
    const n = state.dispatched[0]
    expect(n.type).toBe("member.removed")
    expect(n.user).toBe(bob.id)
    expect(n.team).toBe("t1")
    expect(n.payload).toEqual({
      teamId: "t1",
      teamName: "Home",
      actorUsername: "alice",
    })
  })

  test("self-leave dispatches member.left to the team owner", async () => {
    state.dispatched = []
    state.caller = bob
    await groupsService.removeMember(forToken(futureToken()), "m-bob")
    expect(state.dispatched).toHaveLength(1)
    const n = state.dispatched[0]
    expect(n.type).toBe("member.left")
    expect(n.user).toBe(team.owner)
    expect(n.team).toBe("t1")
    expect(n.payload).toEqual({
      teamId: "t1",
      teamName: "Home",
      actorUsername: "bob",
    })
  })

  test("a failed dispatch never fails the invite", async () => {
    state.dispatched = []
    state.failNotifications = true
    state.caller = alice
    const member = await groupsService.invite(forToken(futureToken()), "t1", {
      userId: bob.id,
      role: "member",
    })
    expect(member.id).toBe(membershipBob.id)
    expect(state.dispatched).toHaveLength(0)
  })

  test("a failed dispatch never fails the removal", async () => {
    state.dispatched = []
    state.failNotifications = true
    state.caller = alice
    await expect(
      groupsService.removeMember(forToken(futureToken()), "m-bob")
    ).resolves.toBeUndefined()
    expect(state.dispatched).toHaveLength(0)
  })
})
