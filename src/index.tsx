import React from "react"
import ReactDOM from "react-dom/client"
import "./styles/globals.css"

import App from "./App"
import { initTheme } from "./stores/theme"

// Apply the persisted theme before first paint to avoid a flash of the wrong
// palette.
initTheme()

const rootEl = document.getElementById("root")
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
