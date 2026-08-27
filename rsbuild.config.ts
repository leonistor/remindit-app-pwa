import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import * as QRCode from "qrcode"
import { pluginPWA } from "rsbuild-plugin-pwa"
import pkg from "./package.json"
import { WEB_APP_MANIFEST } from "./pwa-manifest.config"

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
    }),
  ],
})
