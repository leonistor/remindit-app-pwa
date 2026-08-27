import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource-variable/atkinson-hyperlegible-next"
import "./styles/globals.css"

import App from "./App"
import { initStores, setupDevLogging } from "./stores"
import { initTheme } from "./stores/theme"

// Apply the persisted theme before first paint to avoid a flash of the wrong
// palette, and seed first-run data. Both are idempotent.
initTheme()
initStores()
setupDevLogging()

const rootEl = document.getElementById("root")
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
