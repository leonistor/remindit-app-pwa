// TanStack Start server entry.
//
// Previously the Rsbuild adapter used an injected default; providing our own
// gives us the seam to run Paraglide's `paraglideMiddleware` around the
// request handler (web locale routing). Verified against the installed
// adapter (start-plugin-core 1.168.49): a user `src/server.ts` is picked up
// by the entry planner and its `default` fetch handler is what
// `server.setup` dispatches to in dev, preview, and prerender.
//
// `paraglideMiddleware` extracts the locale from the URL (en unprefixed at
// `/`, `/{ro,de,fr,uk}` prefixed), runs our resolve callback inside its
// AsyncLocalStorage, and hands the (still prefixed) request to the router;
// the router matches the locale via the optional `{-$locale}` route segment,
// so no basepath or manual de-localization is needed. `getLocale()` resolves
// from the middleware's store during SSR; the client derives the same locale
// from `location.pathname`, keeping SSR ↔ hydration in agreement.
//
// The only pre-route rewrite: canonicalize an explicit `/en` prefix back to
// the unprefixed base-locale URL (301, permanent — en belongs at `/`).
//
// The request origin (for `canonical.ts`'s absolute canonical/hreflang links)
// is derived straight from the raw Request headers — no dependency on
// `getRequestUrl()`/H3 context, which isn't available at this handler boundary.
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { paraglideMiddleware } from "./paraglide/server"

const renderApp = createStartHandler(defaultStreamHandler)

const EN_PREFIX = "/en"

function requestOrigin(request: Request): string {
  const url = new URL(request.url)
  const proto = (request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).split(",")[0].trim()
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost"
  return `${proto}://${host}`
}

export default (request: Request, requestOpts?: Parameters<typeof renderApp>[1]) => {
  const url = new URL(request.url)
  const pathname = url.pathname.split("?")[0]
  globalThis.__REMINDIT_ORIGIN__ = requestOrigin(request)
  if (pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`)) {
    const rest = pathname.slice(EN_PREFIX.length) || "/"
    return new Response(null, {
      status: 301,
      headers: { location: `${rest}${url.search}` },
    })
  }
  return paraglideMiddleware(request, () => renderApp(request, requestOpts))
}