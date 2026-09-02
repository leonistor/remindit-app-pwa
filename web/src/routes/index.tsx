import { createFileRoute } from "@tanstack/react-router"
import {
  BRAND_LOGO_SVG,
  BRAND_NAME,
} from "@remindit/common/brand"
import { getStats } from "../lib/stats"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${BRAND_NAME} — shopping lists that remind you`,
      },
      {
        name: "description",
        content:
          "RemindIt is a local-first shopping list app: it learns how often you buy things and reminds you before you run out. Share lists with the people you shop with.",
      },
      { property: "og:title", content: `${BRAND_NAME} — shopping lists that remind you` },
      {
        property: "og:description",
        content:
          "Local-first shopping lists with smart reminders and shared groups.",
      },
      { property: "og:type", content: "website" },
    ],
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
          <h1>Shopping lists that remind you</h1>
          <p>
            {BRAND_NAME} learns how often you buy things and nudges you before
            you run out — offline-first, and shareable with the people you
            shop with.
          </p>
          <a className="cta" href="/download">
            Get the app
          </a>
          <a className="cta secondary" href="/features">
            See features
          </a>

          <div className="stats">
            <div>
              <strong>{stats.users ?? "—"}</strong>
              {stats.users === null ? "users" : stats.users === 1 ? "user" : "users"}
            </div>
            <div>
              <strong>{stats.groups ?? "—"}</strong>
              {stats.groups === null ? "groups" : stats.groups === 1 ? "group" : "groups"}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
