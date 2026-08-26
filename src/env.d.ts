/**
 * Imports the SVG file as a React component.
 * @requires [@rsbuild/plugin-svgr](https://npmjs.com/package/@rsbuild/plugin-svgr)
 */
declare module "*.svg?react" {
  import type React from "react"

  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default ReactComponent
}

/**
 * Imports a Markdown file's raw source as a string. Rspack is configured
 * (rsbuild.config.ts) to treat `.md` as `asset/source`, used to load
 * CHANGELOG.md for the changelog view.
 */
declare module "*.md" {
  const content: string
  export default content
}
