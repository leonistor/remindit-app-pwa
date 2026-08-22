import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import * as QRCode from "qrcode"

export default defineConfig({
  html: {
    template: "public/index.html",
  },
  alias: {
    "@": "./src",
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
  ],
})
