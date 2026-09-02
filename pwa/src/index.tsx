import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource-variable/atkinson-hyperlegible-next"
import "./styles/globals.css"

import App from "./App"
import { getLocale } from "./paraglide/runtime"
import { initStores, setupDevLogging } from "./stores"
import { initSync } from "./stores/sync"
import { initTheme } from "./stores/theme"

// Apply the persisted theme before first paint to avoid a flash of the wrong
// palette, and seed first-run data. Both are idempotent.
initTheme()
initStores()
setupDevLogging()
// Sync overlay (phase 5): connects when a session exists; local-first stays
// the source of truth for every feature regardless.
initSync()

// Reflect the resolved locale on <html lang> before first paint (a11y; the
// static template hardcodes lang="en" while the strategy chain may resolve
// differently — stored choice or browser language).
document.documentElement.lang = getLocale()

const rootEl = document.getElementById("root")
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
