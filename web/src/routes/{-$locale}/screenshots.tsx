import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"
import { m } from "../../paraglide/messages"
import { canonicalLinkTags } from "../../lib/canonical"

export const Route = createFileRoute("/{-$locale}/screenshots")({
  head: ({ match }) => ({
    meta: [
      { title: `${m.webScreenshotsTitle()} — ${BRAND_NAME}` },
      {
        name: "description",
        content: m.webScreenshotsMetaDescription(),
      },
    ],
    links: canonicalLinkTags(match.pathname),
  }),
  component: Screenshots,
})

type Shot = {
  file: string
  device: string
  page: string
}

function Screenshots() {
  // Resolved inside the render body (repo rule — no module-scope m.* calls).
  const shots: Shot[] = [
    { file: "mobile-list-light.png", device: m.webShotDeviceMobile(), page: m.webShotPageList() },
    { file: "mobile-list-dark.png", device: m.webShotDeviceMobile(), page: m.webShotPageList() },
    { file: "mobile-catalog-light.png", device: m.webShotDeviceMobile(), page: m.webShotPageCatalog() },
    { file: "mobile-profile-light.png", device: m.webShotDeviceMobile(), page: m.webShotPageProfile() },
    { file: "desktop-list-light.png", device: m.webShotDeviceDesktop(), page: m.webShotPageList() },
    { file: "desktop-catalog-light.png", device: m.webShotDeviceDesktop(), page: m.webShotPageCatalog() },
    { file: "desktop-history-light.png", device: m.webShotDeviceDesktop(), page: m.webShotPageHistory() },
    { file: "desktop-profile-light.png", device: m.webShotDeviceDesktop(), page: m.webShotPageProfile() },
  ]

  return (
    <main className="container">
      <section className="section">
        <h1>{m.webScreenshotsTitle()}</h1>
        <p className="lead">{m.webScreenshotsIntro()}</p>
        <div className="shots-grid gallery">
          {shots.map((shot) => (
            <figure className="shot" key={shot.file}>
              <img
                src={`/screenshots/${shot.file}`}
                alt={`${shot.device} — ${shot.page}`}
                loading="lazy"
              />
              <figcaption>
                {shot.device} · {shot.page}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  )
}