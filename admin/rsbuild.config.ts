import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild"

export default defineConfig({
  // D9: env from the root .env (root scripts inject via --env-file).
  // Admin dev port defaults to 3300 (pwa 3000, bff 3100, web 3200).
  server: {
    port: Number(process.env.ADMIN_PORT) || 3300,
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
      "admin.remindit.localhost",
      "pwa.remindit.localhost",
      "web.remindit.localhost",
      "admin.remindit.me",
    ],
  },
  plugins: [
    // react's plugin must come after start's plugin (TanStack docs)
    pluginReact(),
    tanstackStart(),
  ],
})
