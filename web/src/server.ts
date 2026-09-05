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
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { paraglideMiddleware } from "./paraglide/server"

const renderApp = createStartHandler(defaultStreamHandler)

export default (request: Request, requestOpts?: Parameters<typeof renderApp>[1]) =>
  paraglideMiddleware(request, () => renderApp(request, requestOpts))