import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"

export default defineConfig({
  html: {
    template: "public/index.html",
  },
  alias: {
    "@": "./src",
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
  ],
})
