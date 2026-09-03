import { Link } from "react-router"
import { m } from "@/paraglide/messages"
import { APP_VERSION } from "@/version"

// Feedback (Apache Answer) origin — build-time PUBLIC_* (D9); localhost
// default matches the other public env reads (bff-api) since the pwa always
// runs against the local platform stack in dev.
const feedbackUrl =
  (import.meta.env?.PUBLIC_FEEDBACK_URL as string | undefined) ??
  "http://localhost:5555"

export const Footer = () => (
  <footer className="shrink-0 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] text-right text-xs">
    <a
      href={feedbackUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {m.footerFeedback()}
    </a>
    {" · "}
    <Link
      to="/changelog"
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      v{APP_VERSION}
    </Link>
  </footer>
)
