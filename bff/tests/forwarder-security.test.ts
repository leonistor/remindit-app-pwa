import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { env } from "../src/env"

const POCKETBASE_URL_ORIGINAL = env.pocketbaseUrl
const nowS = Math.floor(Date.now() / 1000)

const makeJwt = (claims: Record<string, unknown>): string => {
  const enc = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.sig`
}

const freshJwt = makeJwt({
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  type: "auth",
  id: "u1",
  iat: nowS - 3600,
  exp: nowS + 14 * 24 * 60 * 60,
})

const pbRequest = (path: string, init?: RequestInit) =>
  app.request(`/pb${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${freshJwt}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })

describe("forwarder collection allowlist (defense in depth)", () => {
  const stub = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname.startsWith("/api/collections/")) {
        return Response.json({ collection: pathname.split("/")[3] })
      }
      if (pathname === "/api/realtime" || pathname === "/api/echo") {
        return new Response("ok")
      }
      return Response.json({ message: "not found" }, { status: 404 })
    },
  })

  beforeAll(() => {
    env.pocketbaseUrl = `http://127.0.0.1:${stub.port}`
  })
  afterAll(() => {
    env.pocketbaseUrl = POCKETBASE_URL_ORIGINAL
    stub.stop(true)
  })

  for (const col of [
    "teams",
    "categories",
    "items",
    "list_entries",
    "history_events",
    "notifications",
    "team_members",
    "team_member_details",
    "team_details",
    "category_stats",
    "item_stats",
    "list_entries_detailed",
    "_pb_users_auth_",
  ]) {
    test(`GET /pb/api/collections/${col} is allowed`, async () => {
      const res = await pbRequest(`/api/collections/${col}/records`)
      expect(res.status).toBe(200)
    })
  }

  for (const col of ["secrets", "system_settings", "audit_log"]) {
    test(`GET /pb/api/collections/${col} returns 403`, async () => {
      const res = await pbRequest(`/api/collections/${col}/records`)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: "collection not allowed" })
    })
  }

  test("POST to disallowed collection is blocked before reaching PB", async () => {
    const res = await pbRequest("/api/collections/secrets/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    })
    expect(res.status).toBe(403)
  })

  test("non-collection routes are not affected by the guard", async () => {
    const res = await pbRequest("/api/echo")
    expect(res.status).toBe(200)
  })

  test("realtime endpoint is not affected by the guard", async () => {
    const res = await pbRequest("/api/realtime", {
      headers: { accept: "text/event-stream" },
    })
    expect(res.status).toBe(200)
  })
})
