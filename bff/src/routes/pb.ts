// Scoped authenticated PocketBase forwarder (phase 5, docs/SYNC.md): the
// data-plane for the pwa sync engine. The PB JS SDK client-side uses
// `baseUrl = PUBLIC_BFF_URL + "/pb"` — PocketBase itself stays internal (D2).
//
// - Every /pb/* request requires a valid BFF session (requireAuth) and the
//   *rotated* token is forwarded — clients cannot smuggle another identity.
// - Responses stream (realtime SSE passes through unbuffered).
// - Hop-by-hop headers are stripped on both legs; 3xx `location` headers are
//   rewritten/stripped so the internal PB origin never leaks (D2).
// - Only PB's data-plane verbs are proxied; everything else gets 405 + Allow.
import { type Context, Hono } from "hono"
import { env } from "../env"
import { type AppEnv, requireAuth } from "../middleware/auth"
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

// Exactly the verbs PocketBase implements on its data plane (OPTIONS
// preflights are answered by the app-level CORS middleware before routes).
const FORWARDED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"])
const ALLOW = [...FORWARDED_METHODS].join(", ")

/**
 * D2 guard: PB must never become a public surface, and a 3xx `location` is a
 * header the client's browser would navigate to. A location that resolves to
 * the internal PB origin is rewritten onto the BFF's public surface — same
 * path and query, `/pb` re-applied (the reverse of the inbound
 * `pathname.replace(/^\/pb/, "")` strip) — with the origin taken from the
 * incoming request so it stays correct behind proxies. Relative values are
 * legal (RFC 7231) and resolve against the PB target. Anything resolving to
 * a third-party origin is dropped outright, never forwarded.
 *
 * Returns the header value to send, or null when the header must be deleted.
 */
export const rewriteLocation = (
  location: string,
  upstream: URL,
  incoming: URL
): string | null => {
  let resolved: URL
  try {
    resolved = new URL(location, upstream)
  } catch {
    return null // unparseable — never forward
  }
  if (resolved.origin !== upstream.origin) return null // third-party target
  const path = `/pb${resolved.pathname}${resolved.search}`
  return new URL(path, incoming.origin).toString()
}

const forward = async (c: Context<AppEnv, "/api/*">): Promise<Response> => {
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

  if (res.status >= 300 && res.status < 400) {
    const location = responseHeaders.get("location")
    if (location) {
      const rewritten = rewriteLocation(location, target, incoming)
      if (rewritten) responseHeaders.set("location", rewritten)
      else responseHeaders.delete("location")
    }
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  })
}

export const pb = new Hono<AppEnv>()
  .use(requireAuth)
  // Verbs are enumerated (instead of a bare .all) so the forwarder proxies
  // exactly what PB implements; the trailing .all fallback then catches every
  // other verb and answers 405 + Allow — without it Hono would 404 unmatched
  // methods, hiding the actual contract.
  .get("/api/*", forward)
  .post("/api/*", forward)
  .patch("/api/*", forward)
  .delete("/api/*", forward)
  .all("/api/*", (c) =>
    c.json({ error: "method not allowed" }, 405, { Allow: ALLOW })
  )
