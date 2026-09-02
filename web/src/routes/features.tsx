import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: `Features — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Smart catalog with buy-frequency recommendations, offline-first lists, and shared shopping groups.",
      },
    ],
  }),
  component: Features,
})

const FEATURES = [
  {
    title: "Smart catalog",
    body: "Every item remembers how often you buy it — daily staples and monthly staples behave differently.",
  },
  {
    title: "Recommendations before you run out",
    body: "The recommender surfaces overdue and soon-due items so the list fills itself.",
  },
  {
    title: "Offline-first",
    body: "The whole app works without a network: catalog, list, and history live on your device.",
  },
  {
    title: "Shared groups",
    body: "Create a group, invite the people you shop with, and everyone sees the same lists in real time.",
  },
  {
    title: "History that teaches",
    body: "Every add and remove feeds the recommender — the longer you use it, the smarter it gets.",
  },
  {
    title: "Private by design",
    body: "Your data syncs only within your groups. No feeds, no tracking, no ads.",
  },
]

function Features() {
  return (
    <main className="container">
      <section className="section">
        <h2>What’s inside</h2>
        <div className="cards">
          {FEATURES.map((feature) => (
            <div className="card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
