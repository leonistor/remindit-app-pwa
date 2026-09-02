import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

export default defineConfig({
  // D9: env comes from the root .env (injected via `bun --env-file=../.env`
  // by the root scripts). Dev port defaults to 3200 so pwa (3000) and the
  // BFF (3100) can run side by side.
  server: {
    port: Number(process.env.WEB_PORT) || 3200,
  },
  plugins: [
    // react's plugin must come after start's plugin (TanStack docs)
    pluginReact(),
    tanstackStart(),
  ],
})
