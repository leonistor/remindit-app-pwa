import { MantineProvider } from "@mantine/core"
import "@mantine/core/styles.css"
import { BRAND_LOGO_SVG, BRAND_NAME } from "@remindit/common/brand"
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { clearToken, getToken } from "../lib/api"

const faviconHref = `data:image/svg+xml,${encodeURIComponent(BRAND_LOGO_SVG)}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "icon", href: faviconHref, type: "image/svg+xml" }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <RootDocument>
        <Outlet />
      </RootDocument>
    </MantineProvider>
  )
}

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  // Signed-in state only after mount: the SSR pass has no localStorage, so
  // the first client render must match it (hydration) before the nav appears.
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => setSignedIn(getToken() !== null), [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              maxWidth: 960,
              margin: "0 auto",
              padding: "12px 24px",
            }}
          >
            <img src={faviconHref} alt="" width={24} height={24} />
            <strong>{BRAND_NAME} Admin</strong>
            {signedIn && (
              <nav style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
                <Link to="/">Overview</Link>
                <Link to="/users">Users</Link>
                <Link to="/groups">Groups</Link>
                <button
                  type="button"
                  onClick={() => {
                    clearToken()
                    window.location.href = "/login"
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                    font: "inherit",
                  }}
                >
                  Sign out
                </button>
              </nav>
            )}
          </div>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
