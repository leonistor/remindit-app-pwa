// Scoped authenticated PocketBase forwarder (phase 5, docs/SYNC.md): the
// data-plane for the pwa sync engine. The PB JS SDK client-side uses
// `baseUrl = PUBLIC_BFF_URL + "/pb"` — PocketBase itself stays internal (D2).
//
// - Every /pb/* request requires a valid BFF session (requireAuth) and the
//   *rotated* token is forwarded — clients cannot smuggle another identity.
// - Responses stream (realtime SSE passes through unbuffered).
// - Hop-by-hop headers are stripped on both legs.
import { Hono } from "hono"
import { env } from "../env"
import { requireAuth, type AppEnv } from "../middleware/auth"

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
])

export const pb = new Hono<AppEnv>()
  .use(requireAuth)
  .all("/api/*", async (c) => {
    const incoming = new URL(c.req.raw.url)
    const target = new URL(env.pocketbaseUrl)
    target.pathname = incoming.pathname.replace(/^\/pb/, "")
    target.search = incoming.search

    const headers = new Headers(c.req.raw.headers)
    for (const header of HOP_BY_HOP) headers.delete(header)
    headers.set("authorization", `Bearer ${c.get("auth").token}`)

    const method = c.req.method.toUpperCase()
    const hasBody = method !== "GET" && method !== "HEAD"
    const res = await fetch(target, {
      method,
      headers,
      body: hasBody ? c.req.raw.body : undefined,
      // Streaming request bodies (required by undici for stream payloads).
      duplex: "half",
      redirect: "manual",
    })

    const responseHeaders = new Headers(res.headers)
    for (const header of HOP_BY_HOP) responseHeaders.delete(header)

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    })
  })
