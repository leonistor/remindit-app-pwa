import { Link, createFileRoute } from "@tanstack/react-router"
import { BRAND_LOGO_SVG, BRAND_NAME } from "@remindit/common/brand"
import { m } from "../../paraglide/messages"
import { getStats, type PlatformStats } from "../../lib/stats"
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

// The subtitle stat line is a compact sentence built from the plural keys, which
// already own each locale's "N user(s)" phrasing. Passing the resolved phrase in
// as a parameter keeps the sentence grammar per-locale. Null counts drop out of
// the sentence; when the BFF is down entirely the line is hidden.
function countPhrase(
  count: number,
  one: (args: { count: number }) => string,
  other: (args: { count: number }) => string,
): string {
  return count === 1 ? one({ count }) : other({ count })
}

function statLine(stats: PlatformStats): string | null {
  const { users, groups } = stats
  if (users !== null && groups !== null) {
    return m.webHomeStatsLine({
      usersPhrase: countPhrase(users, m.webStatUsersOne, m.webStatUsersOther),
      groupsPhrase: countPhrase(groups, m.webStatGroupsOne, m.webStatGroupsOther),
    })
  }
  if (users !== null) {
    return m.webHomeStatsUsersLine({
      usersPhrase: countPhrase(users, m.webStatUsersOne, m.webStatUsersOther),
    })
  }
  if (groups !== null) {
    return m.webHomeStatsGroupsLine({
      groupsPhrase: countPhrase(groups, m.webStatGroupsOne, m.webStatGroupsOther),
    })
  }
  return null
}

function Home() {
  const stats = Route.useLoaderData()
  const line = statLine(stats)

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
          {line && <p className="stats-line">{line}</p>}
        </div>
      </section>

      {/* The README showcase pair — same two screenshots, as phone mockups. */}
      <section className="shots">
        <div className="shots-grid container">
          <figure>
            <img
              src="/screenshots/mobile-list-light.png"
              alt={`${m.webShotDeviceMobile()} · ${m.webShotPageList()}`}
              width={220}
              height={478}
            />
          </figure>
          <figure>
            <img
              src="/screenshots/mobile-list-dark.png"
              alt={`${m.webShotDeviceMobile()} · ${m.webShotPageList()}`}
              width={220}
              height={478}
            />
          </figure>
        </div>
        <p className="shots-more">
          <Link className="text-link" to="/{-$locale}/screenshots">
            {m.webNavScreenshots()}
          </Link>
        </p>
      </section>

      <section className="section container">
        <h2>{m.webFeaturesSectionTitle()}</h2>
        <p className="lead">{m.webHomeInsidePitch()}</p>
        <p>
          <Link className="text-link" to="/{-$locale}/features">
            {m.webCtaSeeFeatures()}
          </Link>
        </p>
      </section>

      <section className="section container">
        <h2>{m.webComingSoonTitle()}</h2>
        <ul className="coming-soon">
          <li>{m.webComingSoonAttributes()}</li>
          <li>{m.webComingSoonNotifications()}</li>
        </ul>
      </section>

      <section className="section container">
        <p className="muted">
          {m.webOpenSourcePrefix()}{" "}
          <a
            className="text-link"
            href="https://github.com/leonistor/remindit-app-pwa/"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </main>
  )
}