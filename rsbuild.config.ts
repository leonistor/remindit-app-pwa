import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import { paraglideRspackPlugin } from "@inlang/paraglide-js"
import * as QRCode from "qrcode"
import { pluginPWA } from "rsbuild-plugin-pwa"
import pkg from "./package.json"
import { WEB_APP_MANIFEST } from "./pwa-manifest.config"
import { PARAGLIDE_COMPILER_OPTIONS } from "./scripts/compile-i18n"

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
    printUrls({ urls }) {
      urls.map((url) => console.log(`  ➜  ${url}`))
      console.log()
      // use only the last URL to generate the QR code
      QRCode.toString(
        urls.pop() ?? urls[0],
        { type: "terminal" },
        (err, url) => {
          if (err) throw err
          console.log(url)
        }
      )
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
