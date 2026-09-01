# i18n plan — multi-language support in v4 (Paraglide JS)

> **Status: shipped (v4.2.0).** All 7 phases below are done; the plan is kept as the record of the
> locked decisions from the planning session on 2026-09-01.
> Multi-language support moved from Wishlist to **Version 4** in [ROADMAP.md](./ROADMAP.md); v5 (workspace, multi-user, sync) waits.
> Companion docs: [DEV.md](./DEV.md) (architecture), [WORKSPACE-PLAN.md](./WORKSPACE-PLAN.md) (future module layout).
> Work branch: `feat/multi-language-support` (local-only, merged into main at the end — no PRs).

## Requirements

- Languages: **English (default) + Romanian** first; German, French, Ukrainian later.
- PWA UX: language selection is the **first onboarding step**; UI language can be changed **only in the Profile page**.
- The solution must work in this repo **and** the future TanStack Start website (workspace `website` module).
- **Minimal bundle impact**; incremental adoption — no "revolution" in the codebase.
- Translation storage must stay flexible: a plain folder now, movable into a workspace module later.

## Library evaluation (2026-09-01)

| Criteria | **Paraglide JS** ✅ chosen | Lingui (runner-up) |
|---|---|---|
| Architecture | Compiler-first: `messages/*.json` → typed, tree-shakable ESM `m.*` functions | Extract → PO → compile, runtime catalogs |
| Bundle | ~2KB runtime; benchmark 47KB vs 205KB (i18next) for 5 locales/200 messages; unused messages never ship | ~10KB+ (`@lingui/core` + `@lingui/react` provider) + per-locale catalogs |
| Rsbuild compat | Vite plugin does **not** run under Rspack; programmatic/CLI compile produces plain ESM any bundler ships | Same CLI path; needs `I18nProvider` at root |
| TanStack Start (website) | **Official, e2e-tested in TanStack CI**; SSR middleware + built-in i18n routing (`/de/…`) | No official guide; routing DIY |
| Codebase impact | `m.key()` calls, no provider, incremental migration documented | `t`/`<Trans>` macros + provider |
| Typesafety | Generated `m.*` functions with autocomplete (typos = compile errors) | Typed IDs optional |
| Storage | `messages/{locale}.json` + `project.inlang/settings.json` — movable folder | `locales/*.po` — also movable |

Verdict: **Paraglide JS v2** (`@inlang/paraglide-js`, MIT). JSON messages diff well and are trivial for AI-assisted translation; the inlang ecosystem (Sherlock VS Code extension, Fink editor, CLI) is optional, not required.

## Locked decisions

| Decision | Choice |
|---|---|
| Library | Paraglide JS v2 (`@inlang/paraglide-js`) |
| Language-switch behavior | **Full document reload** (Paraglide's default `setLocale`). Fast in a PWA (SW serves the cached shell); all app state is already persisted. No reactive remount / `reload: false` |
| Long-form scope | All UI chrome + **Help + About** translated in v4; **Changelog stays English** (noted in ROADMAP) |
| Pre-choice default | **Auto-detect** browser language (Romanian browsers land in Romanian), English fallback |
| Locale strategy | `["localStorage", "preferredLanguage", "baseLocale"]` with `localStorageKey: "remindit:locale"` |
| Message layout | Flat `messages/{locale}.json` for now; split into namespaces only if a file grows unwieldy |
| Compiler invocation | **`paraglideRspackPlugin` inside `rsbuild.config.ts`** (`tools.rspack.plugins`) — official plugin, dev watch-compiles message edits; plus programmatic `compile()` in `scripts/compile-i18n.ts` (shared `PARAGLIDE_COMPILER_OPTIONS`) chained into `typecheck`/`test*` scripts, which run outside the bundler |
| Output structure | `message-modules` (default) — per-message tree-shaking |

## Phase plan

### Phase 0 — Roadmap (docs)
Version 4 header becomes `in progress`, gains the multi-language item (EN+RO now; DE/FR/UK later; onboarding step + Profile switcher; changelog English-only in v4). Version 5 loses `— in progress`. Wishlist entry removed.

### Phase 1 — Infrastructure
- `bun add @inlang/paraglide-js`
- `project.inlang/settings.json`: `baseLocale: "en"`, `locales: ["en", "ro"]`, message-format plugin, `pathPattern: "./messages/{locale}.json"`
- `messages/en.json`, `messages/ro.json` — **committed** source of truth; `src/paraglide/` generated + gitignored
- `scripts/compile-i18n.ts`: programmatic `compile({ project, outdir: "src/paraglide", strategy: ["localStorage", "preferredLanguage", "baseLocale"], localStorageKey: "remindit:locale", emitTsDeclarations: true })`
- package.json: `i18n:compile` script, chained into `typecheck` / `test` / `test:quick` / `test:changed` / `test:watch` so every entry point that runs outside the bundler has fresh output (the originally drafted `predev` / `prebuild` / `pretest` bun pre-hooks were superseded by this wiring — they never shipped)

### Phase 2 — App wiring (small)
- `src/index.tsx`: set `document.documentElement.lang = getLocale()` **before first paint** (mirrors `initTheme()`)
- `src/lib/locale.ts`: `APP_LOCALES` metadata (`code` + `nativeName`: English, Română; later Deutsch, Français, Українська) + `setAppLocale()` wrapper over `setLocale()`
- No nanostore needed: a locale change reloads the document; Paraglide's localStorage strategy owns persistence
- Erase path (`wipeAllData` → `localStorage.clear()`) wipes `remindit:locale` → erase re-triggers the language prompt (intended)

### Phase 3 — Onboarding language step
- New **first step** before profile: `LanguageChooser` (`src/components/language-chooser.tsx`, Shark `SegmentGroup` or radio list, native names)
- Preselect the currently resolved locale (includes browser auto-detect); selection → persist + document reload → onboarding re-renders in the chosen language (nothing typed yet — zero data loss)
- Update the Steps rail (step count +1); `docs/DEV.md` onboarding section updated

### Phase 4 — Profile switcher
- New Language card in Profile reusing `LanguageChooser`; change → `setAppLocale()` → reload

### Phase 5 — String sweep (parallel sub-agent batches, incremental `m.*`)
1. **Chrome**: menu, footer, install-banner, update-prompt, install-instructions-dialog, back-button, coming-soon, theme-menu/toggle
2. **Shopping**: shopping-list-panel (incl. sort-mode labels), item-catalog, quick-add-dialog, shopping-item, item-detail-drawer
3. **Catalog**: `views/catalog.tsx` + `components/catalog/*` (dialogs, confirm-delete, swipeable row, `frequency-labels.ts` slugs → messages)
4. **Views**: profile, history (relative day labels + date formatting → locale-aware `Intl`), share, onboarding
5. **Help + About** (long-form, translated now). **Changelog view stays English.**
- Plurals/counts via Paraglide variants (`{count, plural, …}`); dates via locale-aware formatters
- Excluded from i18n: catalog item/category names (**data** from seed datasets, not UI strings)

### Phase 6 — Romanian
- Complete `messages/ro.json` (AI-drafted, reviewed by Leo)

### Phase 7 — Verification & docs
- `bun run i18n:compile` → `typecheck` (Paraglide declarations) → `lint` → `test:quick` → `test` → `test:pre`
- Component tests asserting English text get updated during the sweep; Playwright e2e unaffected (default en)
- `bun run build` + Rsbuild `printFileSize` diff to confirm minimal bundle impact
- docs/DEV.md: new §Internationalization (workflow, adding a locale, storage layout, future-workspace note)

## Adding a language later (DE / FR / UK)

1. Add the code to `locales` in `project.inlang/settings.json`
2. Create + translate `messages/{locale}.json`
3. Add an `APP_LOCALES` entry in `src/lib/locale.ts`
4. `bun run i18n:compile`

## Future workspace

`messages/` + `project.inlang/` + the compile script move into a shared module (e.g. `common/i18n`); each app (pwa, website) compiles from it with its own strategy — PWA keeps `localStorage`-based; website (TanStack Start SSR) uses `cookie`/`url` strategies against the same message files. Zero message-file churn.

## Gotchas & risks

- **Plural syntax**: the inlang message-format plugin does **not** support the ICU `#` shorthand; plurals use the array-of-match variants syntax with the variable repeated (`{count, plural, …}` → `declarations`/`selectors`/`match` object). Verified by probe during setup.
- `src/paraglide/` is generated + self-gitignored — `typecheck`/`test*` chain `i18n:compile` first because they run outside the bundler; `dev`/`build` are covered by the Rspack plugin.
- `emitTsDeclarations` needs TS ≥ 5.6 — repo is on the TS 7 native compiler, fine; it also makes a missing/typo'd `m.key` a **type error**, which the merge of all sweep batches relied on.
- `<html lang>` is set at boot before paint (a11y + font/UA styling).
- PWA manifest (`name`, `description`, screenshots) stays English in v4 — out of scope, not in the roadmap item.
- No URL-based locale routing in the PWA (client router, single origin); localized URLs are a website concern.
- Tests matching on English UI strings were updated within their sweep batches to assert `m.*` (they run under the default `en` locale).
- Some help/about messages are **prefix/suffix fragments** wrapped around inline JSX (`<Link>`, `<strong>`); they may begin with punctuation by design — Romanian translations move words across fragment boundaries so the joined sentence reads naturally.

## Session progress (update as work lands)

- [x] Phase 0 — ROADMAP.md updated (v4 in progress, item moved from Wishlist; v5 waits)
- [x] Phase 1 — Paraglide infra (deps, settings, messages, compile script, Rspack plugin)
- [x] Phase 2 — App wiring (html lang, `src/lib/locale.ts`)
- [x] Phase 3 — Onboarding language step (4-step wizard)
- [x] Phase 4 — Profile switcher
- [x] Phase 5 — String sweep (batches 1–5, ~300 keys at sweep time; 336 keys in v4.3.0; en.json merged centrally)
- [x] Phase 6 — Romanian translations complete (314 keys at sign-off; 336 keys in v4.3.0, `null`-free, placeholder parity verified)
- [x] Phase 7 — Gates green (`typecheck`, `lint`, `test:pre` — all Rstest + dev/prod Playwright) + DEV.md §Internationalization

### Review notes for Leo (Phase 6 sign-off)

- `messages/ro.json` is AI-drafted in a consistent informal ("tu") register — a native review pass is expected before release.
- A few help/about keys are deliberately fragment-shaped (prefix/suffix around inline JSX) — the **joined** sentence is what reads naturally, per locale.
- `catalogUncategorized` intentionally stays "Uncategorized" in all locales (it names the data sentinel, like dataset names).
