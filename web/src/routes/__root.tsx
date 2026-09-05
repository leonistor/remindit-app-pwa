import type { ReactNode } from "react"
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import {
  BRAND_BACKGROUND_COLOR,
  BRAND_COLOR,
  BRAND_LOGO_SVG,
  BRAND_NAME,
} from "@remindit/common/brand"
import { m } from "../paraglide/messages"
import { getLocale } from "../paraglide/runtime"
import "../styles.css"

// Inline SVG data URI — works in SSR markup with no extra asset pipeline.
const faviconHref = `data:image/svg+xml,${encodeURIComponent(BRAND_LOGO_SVG)}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: BRAND_COLOR },
      { property: "og:site_name", content: BRAND_NAME },
    ],
    links: [
      { rel: "icon", href: faviconHref, type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // Background/theme colors come from the brand constants (single source
    // of truth, @remindit/common) — kept in sync via inline vars.
    // The locale is rendered from the Paraglide runtime (always the baseLocale
    // under web's `["baseLocale"]` strategy — SSR-safe).
    <html lang={getLocale()} style={{ background: BRAND_BACKGROUND_COLOR }}>
      <head>
        <HeadContent />
        {/* Brand CSS vars come from the constants (single source of truth,
            @remindit/common/brand) so styles.css stays a pure presentational
            stylesheet with no duplicated brand values. */}
        <style>{`:root{--brand-color:${BRAND_COLOR};--brand-background:${BRAND_BACKGROUND_COLOR}}`}</style>
      </head>
      <body>
        <header className="site-header">
          <div className="container">
            <Link to="/" className="brand">
              <img
                className="brand-logo"
                // Brand logo from @remindit/common/brand (see styles note).
                src={faviconHref}
                alt=""
                width={28}
                height={28}
              />
              {BRAND_NAME}
            </Link>
            <nav className="nav">
              <Link to="/features">{m.navFeatures()}</Link>
              <Link to="/download">{m.navGetTheApp()}</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            {BRAND_NAME} — {m.webTagline()}.
          </div>
        </footer>
        <Scripts />
      </body>
    </html>
  )
}
