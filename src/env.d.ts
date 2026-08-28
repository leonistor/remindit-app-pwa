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

/**
 * DiceBear avatar style definitions are imported as JSON subpaths
 * (e.g. `@dicebear/styles/cameo.json`). The package does not ship a typed
 * subpath export for every style, so we declare the wildcard here. The value is
 * only ever passed to `@dicebear/core`'s `Style` constructor.
 */
declare module "@dicebear/styles/*.json" {
  const definition: unknown
  export default definition
}
