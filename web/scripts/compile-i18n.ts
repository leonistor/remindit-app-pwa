/**
 * Shared Paraglide compiler options — single source of truth for both the
 * programmatic compile (`bun scripts/compile-i18n.ts`, used by typecheck
 * which runs outside the bundler) and the Rspack plugin in `rsbuild.config.ts`.
 *
 * The inlang project (catalog + settings) lives in `@remindit/common` — both
 * pwa and web compile from it into their own gitignored `src/paraglide`. The
 * `project`/`outdir` paths are resolved against the cwd (`web/`).
 *
 * Locale strategy: web is SSR (TanStack Start) and currently ships English
 * only — rendering the baseLocale server- and client-side keeps the polish of
 * typed `m.*` functions with zero hydration-mismatch risk. A user-facing
 * locale strategy (URL-based per-locale routing or the storage chain) is
 * future work; bump this then.
 */
import type { CompilerOptions } from "@inlang/paraglide-js"

export const WEB_PARAGLIDE_COMPILER_OPTIONS: CompilerOptions = {
  project: "../common/project.inlang",
  outdir: "./src/paraglide",
  strategy: ["baseLocale"],
  emitTsDeclarations: true,
}

// Only compile when executed directly (`bun scripts/compile-i18n.ts`), not when
// the options are imported by rsbuild.config.ts.
if (import.meta.main) {
  const { compile } = await import("@inlang/paraglide-js")
  await compile(WEB_PARAGLIDE_COMPILER_OPTIONS)
}