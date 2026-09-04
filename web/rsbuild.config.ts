import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

export default defineConfig({
  // D9: env comes from the root .env (injected via `bun --env-file=../.env`
  // by the root scripts). Dev port defaults to 3200 so pwa (3000) and the
  // BFF (3100) can run side by side.
  server: {
    port: Number(process.env.WEB_PORT) || 3200,
    // Bind IPv4 loopback explicitly: the default "localhost" resolves to
    // [::1] on macOS, which the local Caddy proxy can't reach (it targets
    // 127.0.0.1 — see docs/CADDY-LOCAL.md). Loopback-only, unlike pwa's
    // 0.0.0.0 (which is LAN-wide on purpose for the phone QR code).
    host: "127.0.0.1",
    // Local Caddy proxy (docs/CADDY-LOCAL.md) rewrites the Host header to
    // *.remindit.localhost — dev servers reject unknown Host headers by
    // default, so the proxied names must be allowlisted. Production hostnames
    // (deploy/Caddyfile) are included too so the same config serves behind the
    // prod reverse proxy without a separate build.
    allowedHosts: [
      "web.remindit.localhost",
      "pwa.remindit.localhost",
      "admin.remindit.localhost",
      "www.remindit.me",
      "remindit.me",
    ],
  },
  plugins: [
    // react's plugin must come after start's plugin (TanStack docs)
    pluginReact(),
    tanstackStart(),
  ],
})
