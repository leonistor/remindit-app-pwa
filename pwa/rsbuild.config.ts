import { paraglideRspackPlugin } from "@inlang/paraglide-js"
import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import * as QRCode from "qrcode"
import { pluginPWA } from "rsbuild-plugin-pwa"
import pkg from "./package.json"
import { WEB_APP_MANIFEST } from "./pwa-manifest.config"
import { PARAGLIDE_COMPILER_OPTIONS } from "./scripts/compile-i18n"

// Caddy-proxied dev hostnames (docs/CADDY-LOCAL.md): allowlisted on the dev
// server and printed as labeled QR codes at startup. The QR targets are the
// HTTPS public names — no ports, since Caddy serves on 443.
const CADDY_HOSTS = [
  { label: "PWA", host: "pwa.remindit.localhost" },
  { label: "Web", host: "web.remindit.localhost" },
  { label: "Admin", host: "admin.remindit.localhost" },
] as const

export default defineConfig({
  source: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
  html: {
    template: "public/index.html",
  },
  alias: {
    "@": "./src",
  },
  tools: {
    rspack: {
      module: {
        rules: [{ test: /\.md$/, type: "asset/source" }],
      },
      // Compiles messages/*.json into src/paraglide (watched in dev) so
      // message edits hot-compile without restarting the server.
      plugins: [paraglideRspackPlugin(PARAGLIDE_COMPILER_OPTIONS)],
    },
  },
  server: {
    host: "0.0.0.0",
    // Local Caddy proxy (docs/CADDY-LOCAL.md) rewrites the Host header to
    // pwa.remindit.localhost — the dev server rejects unknown Host headers
    // by default, so the proxied name must be allowlisted. Direct-port URLs
    // (http://localhost:3000) stay allowed by the default 'auto' policy.
    // Single source of truth for both this allowlist and the startup QR codes.
    allowedHosts: CADDY_HOSTS.map(({ host }) => host),
    printUrls({ urls }) {
      for (const url of urls) {
        console.log(`  ➜  ${url}`)
      }
      console.log()
      // QR codes target the Caddy HTTPS hostnames (docs/CADDY-LOCAL.md)
      // instead of the raw localhost/LAN URLs above, matching how the app is
      // actually browsed. printUrls is sync-typed in Rsbuild, so the promises
      // are fire-and-forget: failures are logged, never thrown, because an
      // exception inside this callback would crash the dev server.
      for (const { label, host } of CADDY_HOSTS) {
        const url = `https://${host}`
        QRCode.toString(url, { type: "terminal", small: true })
          .then((qr) =>
            console.log(
              `\n  \x1b[1m${label}\x1b[0m  \x1b[2m${url}\x1b[0m\n${qr}`
            )
          )
          .catch((err) =>
            console.error(`Failed to generate QR code for ${url}:`, err)
          )
      }
    },
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
    pluginPWA({
      dev: true,
      webAppManifest: {
        content: WEB_APP_MANIFEST,
      },
      sw: {
        mode: "generateSw",
        workboxOptions: {
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          // SPA deep links must resolve to the cached app shell when offline
          // instead of failing with a browser error page.
          // NOTE: navigateFallback is implemented via createHandlerBoundToURL,
          // which throws at SW evaluation time if the URL is NOT in the
          // precache. The dev server's precache only contains the Workbox
          // suppression script, so we restrict this to production builds.
          // Detection uses NODE_ENV (set by Rsbuild to "development" in dev and
          // "production" in build/preview, before this config is evaluated) —
          // `process.argv` is unreliable here because the dev script runs the
          // bare `rsbuild` binary, which lacks a "dev" token.
          ...(process.env.NODE_ENV !== "production"
            ? {}
            : { navigateFallback: "/index.html" }),
        },
      },
    }),
  ],
})
