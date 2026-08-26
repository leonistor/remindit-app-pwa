import { APP_VERSION } from "@/version"

export const Footer = () => (
  <footer className="shrink-0 py-1 text-right text-muted-foreground text-xs">
    v{APP_VERSION}
  </footer>
)
