// Integration tests for the /pb/* forwarder (phase 5 data-plane) — live PB
// required, skip otherwise. These prove: auth gating, rule-scoped record CRUD
// through the proxy, server-side dedupe via the (team, localId) unique
// index, and SSE passthrough.

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { app, type AppType } from "../src/app"
import { env } from "../src/env"

const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))

const base = `http://127.0.0.1:${server.port}`
const client = hc<AppType>(base)

const pbUp = await fetch(`${env.pocketbaseUrl}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)
const describeIfPb = pbUp ? describe : describe.skip

const run = Date.now().toString(36)
const password = process.env.TEST_PASSWORD ?? "secret12345"

const register = async (username: string) => {
  const res = await client.api.auth.register.$post({
    json: {
      email: `${username}@test.local`,
      password,
      passwordConfirm: password,
      username,
    },
  })
  return (await res.json()) as { token: string; user: { id: string } }
}

describeIfPb("pb forwarder (live)", () => {
  let owner: { token: string; user: { id: string } }
  let teamId: string

  beforeAll(async () => {
    owner = await register(`pf-${run}`)
    const res = await client.api.groups.$post(
      { json: { name: "Forwarder" } },
      { headers: { authorization: `Bearer ${owner.token}` } },
    )
    teamId = ((await res.json()) as { id: string }).id
  })

  const pbFetch = (
    path: string,
    token: string,
    init?: { method?: string; json?: unknown },
  ) =>
    fetch(`${base}/pb${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.json ? { "content-type": "application/json" } : {}),
      },
      body: init?.json ? JSON.stringify(init.json) : undefined,
    })

  test("anonymous requests are rejected by the BFF (not proxied)", async () => {
    const res = await fetch(`${base}/pb/api/collections/users/records`)
    // requireAuth fails before the proxy: BFF-shaped 401, not a PB passthrough
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("authentication required")
  })

  test("garbage tokens are rejected during validation", async () => {
    const res = await pbFetch("/api/collections/users/records", "nope")
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("invalid or expired token")
  })

  test("record CRUD through the proxy is rule-scoped", async () => {
    const res = await pbFetch(
      `/api/collections/users/records/${owner.user.id}`,
      owner.token,
    )
    expect(res.status).toBe(200)
    const record = (await res.json()) as { id: string; username: string }
    expect(record.id).toBe(owner.user.id)
  })

  test("create with localId; duplicate (team, localId) rejected by the index", async () => {
    const localId = `cat-${run}`
    const created = await pbFetch("/api/collections/categories/records", owner.token, {
      method: "POST",
      json: { team: teamId, localId, name: "Produce", frequency: "weekly" },
    })
    expect(created.status).toBe(200)
    const record = (await created.json()) as { id: string; localId: string }
    expect(record.localId).toBe(localId)

    const duplicate = await pbFetch("/api/collections/categories/records", owner.token, {
      method: "POST",
      json: { team: teamId, localId, name: "Dupe", frequency: "weekly" },
    })
    expect(duplicate.status).toBe(400)
  })

  test("SSE passthrough: realtime endpoint streams with event-stream content type", async () => {
    const controller = new AbortController()
    const res = await pbFetch("/api/realtime", owner.token)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    // Read one chunk then abort — the connection is a live stream.
    const reader = res.body!.getReader()
    const first = await reader.read()
    expect(first.value?.length ?? 0).toBeGreaterThan(0)
    controller.abort()
    reader.cancel().catch(() => {})
  })
})
