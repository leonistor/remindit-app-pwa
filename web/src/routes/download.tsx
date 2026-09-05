import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"
import { m } from "../paraglide/messages"

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: `${m.navGetTheApp()} — ${BRAND_NAME}` },
      {
        name: "description",
        content: m.webDownloadMetaDescription({ brandName: BRAND_NAME }),
      },
    ],
  }),
  component: Download,
})

function Download() {
  // The PWA origin is env-driven (D9) — deploy-time config, not a build-time
  // brand constant. When unset at deploy, degrade to neutral copy: never
  // render a user-facing localhost link.
  const pwaUrl = import.meta.env?.PUBLIC_PWA_URL

  return (
    <main className="container">
      <section className="section">
        <h2>{m.webDownloadTitle({ brandName: BRAND_NAME })}</h2>
        <p>{m.webDownloadIntro({ brandName: BRAND_NAME })}</p>
        {pwaUrl && (
          <p>
            <a className="cta" href={pwaUrl}>
              {m.webOpenApp()}
            </a>
          </p>
        )}
        <ol className="steps">
          <li>
            {pwaUrl
              ? m.webDownloadStep1WithUrl({ url: pwaUrl })
              : m.webDownloadStep1NoUrl()}
          </li>
          <li>
            <strong>{m.webDownloadStep2Device()}</strong>{" "}
            {m.webDownloadStep2Action()}
          </li>
          <li>
            <strong>{m.webDownloadStep3Device()}</strong>{" "}
            {m.webDownloadStep3Action()}
          </li>
          <li>
            <strong>{m.webDownloadStep4Device()}</strong>{" "}
            {m.webDownloadStep4Action()}
          </li>
        </ol>
      </section>
    </main>
  )
}
