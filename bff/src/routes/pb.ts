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
import { PocketBaseUnavailableError } from "../repositories/pocketbase"

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

// Generous cap for request/response pairs (realtime SSE is exempt below) —
// only meant to reap requests whose client vanished without hanging up.
const UPSTREAM_TIMEOUT_MS = 120_000

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
    // SSE (realtime) is a long-lived GET: never cap it with a timeout — only
    // the client's own disconnect may cancel the stream.
    const sse =
      method === "GET" &&
      (c.req.header("accept") ?? "").includes("text/event-stream")
    const signal = sse
      ? c.req.raw.signal
      : AbortSignal.any([
          c.req.raw.signal,
          AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        ])

    let res: Response
    try {
      res = await fetch(target, {
        method,
        headers,
        body: hasBody ? c.req.raw.body : undefined,
        // Streaming request bodies (required by undici for stream payloads).
        duplex: "half",
        redirect: "manual",
        signal,
      })
    } catch (error) {
      if (c.req.raw.signal.aborted) throw error // client went away
      if (error instanceof Error && error.name === "TimeoutError") {
        return c.json({ error: "upstream timeout" }, 504)
      }
      // Network-level failure (PB refused/unreachable) — same retryable
      // contract as the auth middleware; app.onError shapes it as 503.
      throw new PocketBaseUnavailableError(error)
    }

    const responseHeaders = new Headers(res.headers)
    for (const header of HOP_BY_HOP) responseHeaders.delete(header)

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    })
  })
