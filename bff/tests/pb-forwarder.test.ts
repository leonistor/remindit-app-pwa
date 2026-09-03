// Unit tests for the /pb/* forwarder's verb allowlist, 3xx redirect handling
// and incoming-query forwarding (TODO P3/P4) — run unconditionally against a
// stubbed PocketBase (Bun.serve); the live integration suite covers real-PB
// behavior separately.
// Like auth-middleware.test.ts, repositories/env swap works because pb.ts
// reads env.pocketbaseUrl at call time, and the unsigned JWT rides the
// middleware's local-decode fast path (PB re-validates upstream, and the
// stub ignores the token).

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { env } from "../src/env"
import { rewriteLocation } from "../src/routes/pb"

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

describe("pb forwarder verbs + query forwarding (stubbed PB)", () => {
  const stub = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname, origin } = new URL(req.url)
      const redirect = (location: string) =>
        new Response(null, { status: 302, headers: { location } })
      if (pathname === "/api/redirect/absolute")
        return redirect(`${origin}/api/collections/users/records?filter=x`)
      if (pathname === "/api/redirect/relative")
        return redirect("/api/collections/users/records")
      if (pathname === "/api/redirect/external")
        return redirect("https://evil.example/phish?next=/home")
      if (pathname === "/api/redirect/unparseable")
        return redirect("http://[::1/nope")
      if (pathname === "/api/echo-method")
        return Response.json({ method: req.method })
      if (pathname === "/api/echo-query") {
        const url = new URL(req.url)
        return Response.json({
          search: url.search,
          params: Object.fromEntries(url.searchParams),
        })
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

  test("GET/POST/PATCH/DELETE are forwarded (regression)", async () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
      const res = await pbRequest("/api/echo-method", { method })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ method })
    }
  })

  test("PUT is rejected with 405 + Allow (not proxied)", async () => {
    const res = await pbRequest("/api/echo-method", { method: "PUT" })
    expect(res.status).toBe(405)
    expect(res.headers.get("allow")).toBe("GET, POST, PATCH, DELETE")
    expect(await res.json()).toEqual({ error: "method not allowed" })
  })

  test("TRACE is rejected with 405 + Allow (not proxied)", async () => {
    const res = await pbRequest("/api/echo-method", { method: "TRACE" })
    expect(res.status).toBe(405)
    expect(res.headers.get("allow")).toBe("GET, POST, PATCH, DELETE")
  })

  test("incoming query strings are forwarded intact (path rewrite strips only /pb)", async () => {
    const res = await pbRequest("/api/echo-query?a=1&b=two")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      search: "?a=1&b=two",
      params: { a: "1", b: "two" },
    })
  })

  test("encoded query values survive the forward (PB filter syntax)", async () => {
    // PB filters are `field = "value"` expressions riding percent-encoded in
    // the query — the forwarder must not decode/re-encode them.
    const filter = encodeURIComponent('(name = "Produce")')
    const res = await pbRequest(
      `/api/echo-query?filter=${filter}&perPage=5&sort=-created`
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      search: string
      params: Record<string, string>
    }
    expect(body.search).toBe(
      "?filter=(name%20%3D%20%22Produce%22)&perPage=5&sort=-created"
    )
    expect(body.params.filter).toBe('(name = "Produce")')
    expect(body.params.perPage).toBe("5")
    expect(body.params.sort).toBe("-created")
  })

  test("3xx with an internal absolute location is rewritten to the client-facing /pb origin", async () => {
    const res = await pbRequest("/api/redirect/absolute")
    expect(res.status).toBe(302)
    const location = res.headers.get("location")
    expect(location).not.toContain("127.0.0.1") // internal origin never leaks
    expect(location).toBe(
      "http://localhost/pb/api/collections/users/records?filter=x"
    )
  })

  test("3xx with a relative location resolves against PB and re-prefixes /pb", async () => {
    const res = await pbRequest("/api/redirect/relative")
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(
      "http://localhost/pb/api/collections/users/records"
    )
  })

  test("3xx with a third-party absolute location has the header stripped", async () => {
    const res = await pbRequest("/api/redirect/external")
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBeNull()
  })

  test("3xx with an unparseable location has the header stripped", async () => {
    const res = await pbRequest("/api/redirect/unparseable")
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBeNull()
  })
})

describe("rewriteLocation (unit)", () => {
  const upstream = new URL("http://127.0.0.1:8090")
  const incoming = new URL("http://localhost:3100/pb/api/health")

  test("absolute same-origin location keeps path + query, swaps origin and re-prefixes /pb", () => {
    expect(
      rewriteLocation("http://127.0.0.1:8090/api/x?a=1", upstream, incoming)
    ).toBe("http://localhost:3100/pb/api/x?a=1")
  })

  test("relative location (with and without leading slash) resolves against PB", () => {
    expect(rewriteLocation("/api/health", upstream, incoming)).toBe(
      "http://localhost:3100/pb/api/health"
    )
    expect(rewriteLocation("api/health", upstream, incoming)).toBe(
      "http://localhost:3100/pb/api/health"
    )
  })

  test("third-party origin is dropped — including a different port on the PB host", () => {
    expect(
      rewriteLocation("https://evil.example/x", upstream, incoming)
    ).toBeNull()
    expect(rewriteLocation("//evil.example/x", upstream, incoming)).toBeNull()
    expect(
      rewriteLocation("http://127.0.0.1:9999/api/x", upstream, incoming)
    ).toBeNull()
  })

  test("unparseable location is dropped", () => {
    expect(rewriteLocation("http://[::1", upstream, incoming)).toBeNull()
  })
})
