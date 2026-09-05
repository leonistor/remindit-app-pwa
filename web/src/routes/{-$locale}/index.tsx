import { Link, createFileRoute } from "@tanstack/react-router"
import { BRAND_LOGO_SVG, BRAND_NAME } from "@remindit/common/brand"
import { m } from "../../paraglide/messages"
import { getStats } from "../../lib/stats"
import { canonicalLinkTags } from "../../lib/canonical"

export const Route = createFileRoute("/{-$locale}/")({
  head: ({ match }) => ({
    meta: [
      {
        title: `${BRAND_NAME} — ${m.webTagline()}`,
      },
      {
        name: "description",
        content: m.webMetaDescription(),
      },
      { property: "og:title", content: `${BRAND_NAME} — ${m.webTagline()}` },
      {
        property: "og:description",
        content: m.webOgDescription(),
      },
      { property: "og:type", content: "website" },
    ],
    links: canonicalLinkTags(match.pathname),
  }),
  loader: () => getStats(),
  component: Home,
})

function Home() {
  const stats = Route.useLoaderData()

  return (
    <main>
      <section className="hero">
        <div className="container">
          <img
            className="hero-logo"
            // Brand logo from @remindit/common/brand (single source of truth).
            src={`data:image/svg+xml,${encodeURIComponent(BRAND_LOGO_SVG)}`}
            alt=""
            width={96}
            height={96}
          />
          <h1>{m.webHeroTitle()}</h1>
          <p>{m.webHeroDescription({ brandName: BRAND_NAME })}</p>
          <Link className="cta" to="/{-$locale}/download">
            {m.navGetTheApp()}
          </Link>
          <Link className="cta secondary" to="/{-$locale}/features">
            {m.webCtaSeeFeatures()}
          </Link>

          <div className="stats">
            <div>
              <strong>{stats.users ?? "—"}</strong>
              {stats.users !== null &&
                (stats.users === 1
                  ? m.webStatUsersOne({ count: 1 })
                  : m.webStatUsersOther({ count: stats.users }))}
            </div>
            <div>
              <strong>{stats.groups ?? "—"}</strong>
              {stats.groups !== null &&
                (stats.groups === 1
                  ? m.webStatGroupsOne({ count: 1 })
                  : m.webStatGroupsOther({ count: stats.groups }))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}