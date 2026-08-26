import { Link } from "react-router"
import { APP_VERSION } from "@/version"

export const Footer = () => (
  <footer className="shrink-0 py-1 text-right text-xs">
    <Link
      to="/changelog"
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      v{APP_VERSION}
    </Link>
  </footer>
)
