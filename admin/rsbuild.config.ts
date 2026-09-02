import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

export default defineConfig({
  // D9: env from the root .env (root scripts inject via --env-file).
  // Admin dev port defaults to 3300 (pwa 3000, bff 3100, web 3200).
  server: {
    port: Number(process.env.ADMIN_PORT) || 3300,
  },
  plugins: [
    // react's plugin must come after start's plugin (TanStack docs)
    pluginReact(),
    tanstackStart(),
  ],
})
