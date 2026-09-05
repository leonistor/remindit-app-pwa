/**
 * Shared Paraglide compiler options — single source of truth for both the
 * programmatic compile (`bun scripts/compile-i18n.ts`, used by typecheck/tests
 * which run outside the bundler) and the Rspack plugin in `rsbuild.config.ts`.
 *
 * The inlang project (catalog + settings) lives in `@remindit/common` — both
 * pwa and web compile from it into their own gitignored `src/paraglide`. The
 * `project`/`outdir` paths are resolved against the cwd (`pwa/`).
 *
 * Locale strategy (first match wins):
 *   localStorage       → persisted user choice (onboarding step 1 / Profile)
 *   preferredLanguage  → browser auto-detect before any choice (ro browsers → ro)
 *   baseLocale         → English fallback
 */
import type { CompilerOptions } from "@inlang/paraglide-js"

export const PARAGLIDE_COMPILER_OPTIONS: CompilerOptions = {
  project: "../common/project.inlang",
  outdir: "./src/paraglide",
  strategy: ["localStorage", "preferredLanguage", "baseLocale"],
  localStorageKey: "remindit:locale",
  emitTsDeclarations: true,
}

// Only compile when executed directly (`bun scripts/compile-i18n.ts`), not when
// the options are imported by rsbuild.config.ts.
if (import.meta.main) {
  const { compile } = await import("@inlang/paraglide-js")
  await compile(PARAGLIDE_COMPILER_OPTIONS)
}
