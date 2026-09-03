import { Link } from "react-router"
import { m } from "@/paraglide/messages"
import { APP_VERSION } from "@/version"

// Feedback (Apache Answer) origin — build-time PUBLIC_* (D9). Rendered only
// when set: no localhost fallback, so a deploy-time build without the var
// hides the link instead of shipping a broken URL (H15 rule, mirrors web).
const feedbackUrl = import.meta.env?.PUBLIC_FEEDBACK_URL as string | undefined

export const Footer = () => (
  <footer className="shrink-0 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] text-right text-xs">
    {feedbackUrl && (
      <>
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {m.footerFeedback()}
        </a>
        {" · "}
      </>
    )}
    <Link
      to="/changelog"
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      v{APP_VERSION}
    </Link>
  </footer>
)
