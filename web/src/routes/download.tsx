import { createFileRoute } from "@tanstack/react-router"
import { BRAND_NAME } from "@remindit/common/brand"

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: `Get the app — ${BRAND_NAME}` },
      {
        name: "description",
        content: `Install the ${BRAND_NAME} PWA on your phone or desktop — no app store required.`,
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
        <h2>Get {BRAND_NAME}</h2>
        <p>
          {BRAND_NAME} is a PWA — it installs straight from the browser, no app
          store needed, and updates itself.
        </p>
        {pwaUrl && (
          <p>
            <a className="cta" href={pwaUrl}>
              Open the app
            </a>
          </p>
        )}
        <ol className="steps">
          <li>
            {pwaUrl ? (
              <>
                Open <strong>{pwaUrl}</strong> on your phone or desktop.
              </>
            ) : (
              <>Open the app URL you received on your phone or desktop.</>
            )}
          </li>
          <li>
            <strong>iPhone / iPad:</strong> Share → <em>Add to Home Screen</em>.
          </li>
          <li>
            <strong>Android:</strong> menu → <em>Add to Home screen</em>.
          </li>
          <li>
            <strong>Desktop:</strong> install icon in the address bar.
          </li>
        </ol>
      </section>
    </main>
  )
}
