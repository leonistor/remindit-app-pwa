import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"
import { m } from "../../paraglide/messages"

export const Route = createFileRoute("/{-$locale}/features")({
  head: () => ({
    meta: [
      { title: `${m.navFeatures()} — ${BRAND_NAME}` },
      {
        name: "description",
        content: m.webFeaturesMetaDescription(),
      },
    ],
  }),
  component: Features,
})

function Features() {
  // Resolved inside the render body (repo rule — no module-scope m.* calls:
  // a message call at import time would freeze the string to the initial locale).
  const features = [
    {
      title: m.webFeatureCatalogTitle(),
      body: m.webFeatureCatalogBody(),
    },
    {
      title: m.webFeatureRecommendationsTitle(),
      body: m.webFeatureRecommendationsBody(),
    },
    {
      title: m.webFeatureOfflineTitle(),
      body: m.webFeatureOfflineBody(),
    },
    {
      title: m.webFeatureGroupsTitle(),
      body: m.webFeatureGroupsBody(),
    },
    {
      title: m.webFeatureHistoryTitle(),
      body: m.webFeatureHistoryBody(),
    },
    {
      title: m.webFeaturePrivacyTitle(),
      body: m.webFeaturePrivacyBody(),
    },
  ]

  return (
    <main className="container">
      <section className="section">
        <h2>{m.webFeaturesSectionTitle()}</h2>
        <div className="cards">
          {features.map((feature) => (
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