import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"
import { m } from "../../paraglide/messages"
import { canonicalLinkTags } from "../../lib/canonical"
import { DemoVideo } from "../../components/demo-video"

export const Route = createFileRoute("/{-$locale}/features")({
  head: ({ match }) => ({
    meta: [
      { title: `${m.navFeatures()} — ${BRAND_NAME}` },
      {
        name: "description",
        content: m.webFeaturesMetaDescription(),
      },
    ],
    links: canonicalLinkTags(match.pathname),
  }),
  component: Features,
})

type FeatureSection = {
  title: string
  body: string
  videos?: {
    src: string
    poster: string
    label: string
  }[]
}

function Features() {
  // Resolved inside the render body (repo rule — no module-scope m.* calls:
  // a message call at import time would freeze the string to the initial locale).
  const sections: FeatureSection[] = [
    { title: m.webFsStartTitle(), body: m.webFsStartBody() },
    {
      title: m.webFsBuildTitle(),
      body: m.webFsBuildBody(),
      videos: [
        {
          src: "/demos/03-add-items-light.mp4",
          poster: "/screenshots/mobile-list-light.png",
          label: m.webFsBuildVideoAdd(),
        },
        {
          src: "/demos/04-quick-add-light.mp4",
          poster: "/screenshots/mobile-list-light.png",
          label: m.webFsBuildVideoQuickAdd(),
        },
      ],
    },
    {
      title: m.webFsCatalogTitle(),
      body: m.webFsCatalogBody(),
      videos: [
        {
          src: "/demos/06-edit-catalog-light.mp4",
          poster: "/screenshots/mobile-catalog-light.png",
          label: m.webFsCatalogVideo(),
        },
      ],
    },
    { title: m.webFsRecommendTitle(), body: m.webFsRecommendBody() },
    { title: m.webFsHistoryTitle(), body: m.webFsHistoryBody() },
    { title: m.webFsSharedTitle(), body: m.webFsSharedBody() },
    { title: m.webFsDataTitle(), body: m.webFsDataBody() },
    { title: m.webFsCustomTitle(), body: m.webFsCustomBody() },
    { title: m.webFsShareTitle(), body: m.webFsShareBody() },
  ]

  return (
    <main className="container">
      <section className="section">
        <h2>{m.webFeaturesSectionTitle()}</h2>
        {sections.map((section) => (
          <article className="feature-row" key={section.title}>
            <div className="feature-copy">
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
            {section.videos && (
              <div className="feature-media">
                {section.videos.map((video) => (
                  <DemoVideo key={video.label} {...video} />
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}