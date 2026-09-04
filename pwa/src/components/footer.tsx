import { Fragment } from "react"
import { Link } from "react-router"
import { m } from "@/paraglide/messages"
import { APP_VERSION } from "@/version"

// Feedback (Apache Answer) origin — build-time PUBLIC_* (D9). Rendered only
// when set: no localhost fallback, so a deploy-time build without the var
// hides the links instead of shipping a broken URL (H15 rule, mirrors web).
const feedbackUrl = import.meta.env?.PUBLIC_FEEDBACK_URL as string | undefined

export const Footer = () => {
  // Tag-filtered deep links into the Answer board; resolved in the render
  // body so the labels follow the active locale (module-scope m.* calls would
  // freeze at import time).
  const feedbackLinks = [
    {
      href: `${feedbackUrl}/questions?tag=bug`,
      label: m.footerFeedbackBug(),
    },
    {
      href: `${feedbackUrl}/questions?tag=feature-request`,
      label: m.footerFeedbackFeatureRequest(),
    },
    {
      href: `${feedbackUrl}/questions?tag=discussion`,
      label: m.footerFeedbackDiscussion(),
    },
  ]

  return (
    <footer className="shrink-0 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] text-right text-xs">
      {feedbackUrl &&
        feedbackLinks.map(({ href, label }) => (
          <Fragment key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {label}
            </a>
            {" · "}
          </Fragment>
        ))}
      <Link
        to="/changelog"
        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        v{APP_VERSION}
      </Link>
    </footer>
  )
}
