/**
 * Shared Paraglide compiler options — single source of truth for both the
 * programmatic compile (`bun scripts/compile-i18n.ts`, used by typecheck
 * which runs outside the bundler) and the Rspack plugin in `rsbuild.config.ts`.
 *
 * The inlang project (catalog + settings) lives in `@remindit/common` — both
 * pwa and web compile from it into their own gitignored `src/paraglide`. The
 * `project`/`outdir` paths are resolved against the cwd (`web/`).
 *
 * Locale strategy: web is SSR (TanStack Start). URL-based per-locale routing
 * (en unprefixed at `/`, then `/ro`, `/de`, `/fr`, `/uk`) renders the shared
 * catalog server-side per request; the optional `{-$locale}` route segment
 * keeps the prefix in the URL client-side. `src/server.ts` wraps the request
 * handler with `paraglideMiddleware`, which drives SSR `getLocale()` and
 * redirects mismatched document requests to the canonical localized URL.
 */
import type { CompilerOptions } from "@inlang/paraglide-js"

export const WEB_PARAGLIDE_COMPILER_OPTIONS: CompilerOptions = {
  project: "../common/project.inlang",
  outdir: "./src/paraglide",
  strategy: ["url", "baseLocale"],
  emitTsDeclarations: true,
}

// Only compile when executed directly (`bun scripts/compile-i18n.ts`), not when
// the options are imported by rsbuild.config.ts.
if (import.meta.main) {
  const { compile } = await import("@inlang/paraglide-js")
  await compile(WEB_PARAGLIDE_COMPILER_OPTIONS)
}