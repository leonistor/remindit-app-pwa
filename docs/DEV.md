# development

> Design reference: [`DESIGN.md`](../DESIGN.md) — visual system as shipped (tokens, palettes, layout, motion, a11y). This doc covers architecture & state.

## Application Layout

The app is a multi-route SPA (`src/router.tsx`, `createBrowserRouter`): one shared `Layout` hosts the main routes, and `/onboarding` is a chrome-less top-level route. The `Layout` renders a top menu bar, a content area (`<Outlet />`), and a discreet version footer (hidden on the main shopping view). A first-run gate redirects to `/onboarding` while `$onboarded` is false (`<Navigate to="/onboarding" replace />`), so the menu never shows during onboarding.

```
DrawerProvider
├── Menu (min-h-14 md:min-h-16 bar: logo, profile avatar, "Shopping list" link,
│   hamburger menu with nav links + install item + theme picker — no quick-add (+) button)
├── <Outlet /> (page content)
├── ItemDetailDrawer (context-managed, hidden by default)
├── InstallBanner (fixed bottom, mounts 1.5s after the app becomes installable)
├── UpdatePrompt (fixed bottom, while a service worker is waiting)
└── Footer (version → /changelog; hidden on "/")
```

The quick-add `+` button lives in the shopping-list panel's floating button group (`src/components/shopping-list-panel.tsx`, next to the sort button) — not in the menu.

### Main view (`/`)

A resizable two-panel split (`ShoppingPanels`):

| Panel | Content |
|---|---|
| Left (30%) | Items on the active shopping list (single cycling sort button that floats above the list via `@shark/float`) |
| Right (70%) | `ItemCatalog` — catalog items grouped by category |

Catalog items show recommendation badges (overdue/soon dots) based on the computed `$recommendations` store. Each category's accordion trigger also shows a neutral `Badge` (`variant="secondary"`, `size="sm"`) with the count of **visibly recommended** items in that category — exactly the tiers that render a dot (`overdue`/`soon`, via `isRecommended` in `src/lib/recommendation-tiers.ts`), counted reactively by `$recommendedCountByCategoryId` (`src/stores/selectors.ts`). The count tracks the acted-upon lifecycle: adding an item to the list removes it from `$recommendations` (badge drops); putting it back re-enters `$recommendations` but as dotless `frequent` (fresh add event → due_ratio ≈ 0), so the badge stays down.

### Item detail drawer

A context-managed drawer (`DrawerProvider` + `ItemDetailDrawer`) sits at the Layout level. `openDrawer(itemId)` (via `useDrawerContext()`, `src/components/drawer-context.tsx`) is **reserved for Phase 3** and is intentionally not wired into the item UI yet — `ItemDetailDrawer` currently renders placeholder content. Phase 3 will populate it with item attributes (photo, quantity, price).

### Routes

| Path | View | Description |
|---|---|---|
| `/` | ShoppingPanels | Main shopping list + catalog |
| `/catalog` | CatalogView | Manage catalog items |
| `/history` | HistoryView | View shopping history |
| `/profile` | ProfileView | User profile (avatar editing, backup import), catalog link, palette, reset & reseed |
| `/share` | ShareView | Share the pending shopping list as a PNG image |
| `/about` | AboutView | About the app |
| `/changelog` | ChangelogView | Version history (linked from the footer version) |
| `/help` | HelpView | Usage help |
| `/onboarding` | OnboardingView | First-run language + profile + dataset setup (no menu chrome) |

### PWA manifest

The installable web manifest is defined in `pwa-manifest.config.ts` (the `WEB_APP_MANIFEST` object), **not** inline in `rsbuild.config.ts`. Brand color for both the manifest and the generated icons lives in that same file as `PWA_THEME_COLOR` / `PWA_BACKGROUND_COLOR` — both default to the **neutral app primary** (`#262626`, background `#ffffff`), reconciled with the neutral UI chrome. `scripts/generate-favicons.ts` imports those same constants when regenerating icons, so the manifest and favicons stay in sync. The master icon SVGs (`public/remindit-icon.svg`, `public/remindit-icon-maskable.svg`) carry the same `#262626` fill.

### PWA install & update

Two independent prompts, both rendered at the `Layout` level (`src/router.tsx`):

- **Install banner** (`src/components/install-banner.tsx`) — fixed bottom; mounts **1.5s after** `$showInstallBanner` flips true so it never pops on first paint. `src/stores/pwa-install.ts` wraps `pwa-install-handler` (captures the browser's `beforeinstallprompt`) into `$canInstall` / `$installed`, plus the computed `$showInstallBanner`; `initPwaInstall()` wires the listeners exactly once (called from the `Layout` effect). "No" persists `remindit:install-dismissed` forever (`dismissInstall`); "Maybe later" is session-only (`$installLater`). Non-Chromium platforms never see the banner — the menu's "Install Remindit" item routes them to manual "Add to Home Screen" instructions instead (`src/lib/pwa-install.ts` `detectPlatform()` → `InstallInstructionsDialog`).
- **Update prompt** (`src/components/update-prompt.tsx` + `src/hooks/use-sw-update.ts`) — shows while a service worker is `waiting`; "Reload" posts `SKIP_WAITING` to the Workbox-generated worker and reloads on activation.

## UI components (Shark UI)

> Visual details (palettes, semantic tokens, item-chip rules, motion) live in [`DESIGN.md` §4–8](../DESIGN.md). Below is the implementation view.

Our primary UI framework is **Shark UI** — a shadcn-style component registry built on top of [Ark UI](https://ark-ui.com). Shark UI is the framework; Ark UI is only its internal foundation. Components live in `src/components/ui/*` and are added from the registry with the shadcn CLI:

```bash
bunx shadcn add @shark/<component>
```

Registry config lives in `components.json` (style `base-nova`, Phosphor icons, `@shark` registry at `https://shark.vini.one/r/{name}.json`).

**Rules:**

- Build feature UI from the existing `src/components/ui/*` Shark primitives — do **not** reach for raw `@ark-ui/react` in feature components. If a primitive is missing, add it via the CLI (or wrap Ark UI in `src/components/ui` following the existing pattern) instead of importing Ark directly.
- Use `cn()` from `@/lib/utils` and Shark's built-in `variant` / `size` props and semantic tokens (`bg-primary`, `text-muted-foreground`, `border-input`). Avoid ad-hoc `dark:` palette pairs and `space-x/y-*`.
- The registry docs/examples are the source of truth for each component's API and composition — check them before assuming an Ark/Radix/shadcn API.

#### Registry vs. custom components

Components are split between **registry-managed** primitives in `src/components/ui/*` (installed via
`bunx shadcn add @shark/<component>`) and **hand-maintained / derived** components in
`src/components/ui/custom/*` that must never be regenerated from the CLI. The custom set currently
holds `button` (our fork of the Shark button — adds `success`/`info`/`bare` variants; `bare` is a
transparent base for components that supply their own color via the categorical palette, and does
**not** force a hover background so palette-colored chips keep their fill), the project-specific
`item-button`, `toggle-tooltip`, `form-dialog`, and `validated-field`, and `collection.ts` — the
sanctioned `@ark-ui/react` re-export seam (feature code still never imports Ark directly; it imports
Ark's collection helpers from `ui/custom/collection`). **Do not run `shadcn add @shark/button`** — the
registry HEAD drops those variants and would break the build. Item/category color lives in
`src/lib/category-palette.ts` (qualitative, colorblind-safe) and is intentionally distinct from the
recommendation-tier colors in `src/lib/recommendation-tiers.ts`.
See [`DEV-COMPONENTS.md`](./DEV-COMPONENTS.md) for the full registry-vs-custom split and the latest
upstream update-check findings.

### Item display components

Two feature components render items; pick the right one for the context:

- **`ItemButton`** (`src/components/ui/custom/item-button.tsx`) — used for *available* catalog items. Shows only the item name and supports `selectable` / `removable` / `recommendation` purposes. Color is **decoupled from `Button` variants**: it renders `<Button variant="bare">` and applies a **solid palette background** (the full categorical hue) with a WCAG-contrast text color, via `categoryKey` (the category id; keyed by id so it matches the shopping list) resolved through `useCategoryPalette` (see below). `paletteOverride` (a palette index) overrides the resolved color; normally omitted because the hook already applies the category's stored sequential slot, so chips stay distinct. `isSelected` (or the `removable`/`recommendation` purpose) drives the emphasized solid treatment; a `selectable` item that is already selected uses the muted `dimmed` tint. Desktop hover adds an **emphasis ring** (`palette.ring` = `ring-foreground` + `hover:ring-2`) so the categorical fill is preserved — the `bare` variant does **not** override the hover background. The ring draws outside the chip against the page background, so it uses the theme-aware `foreground` token (not `--cat-ink`, which contrasts the fill and can match the page background and vanish); the panels' scroll containers keep 4px of compensated padding so the ring isn't clipped at their edges. `animationState` (`enter`/`exit`) hooks the TailMotion `tm-scale-in`/`tm-scale-out` classes (scale 0.92 preserved via `--tm-scale-from`/`--tm-exit-scale`; reduced motion handled by TailMotion — see [Motion in DESIGN.md §7](../DESIGN.md#7-motion)). The recommendation-tier dot stays a separate semantic concern (see `recommendation-tiers.ts`).
- **`ShoppingItem`** (`src/components/shopping-item.tsx`) — used for *selected* list items. Renders a Shark UI `Badge` (category label, defaults to `"Uncategorized"`) above the item name, colored by the shared categorical palette (via `useCategoryPalette`), and the chip itself uses the selected/emphasized palette treatment (the button is `bare` + palette tokens, not the `success` variant), plus the same `hover:ring-2` emphasis ring. Both key off `categoryId` so the color matches the catalog for the same category. Props: `name`, `categoryName?`, **`categoryId?`** (stable id used as the palette key; falls back to `categoryName`), **`showCategory`** (boolean, defaults to `true` — hides the Badge when `false`), `disabled?`, `onClick?`, `className?`. Left-aligned via `items-start`.

### Categorical color palette

Category/item colors come from a **pool of palettes** (`src/lib/palettes.ts`: `PALETTE_POOL`, `getPalette`, `defaultPalette`). `src/lib/category-palette.ts` exposes the pure `categoryPalette(key, overrideSlot?, palette = defaultPalette)` which maps a category id (or explicit palette index) to an `ItemPalette` of CSS-var style tokens. It is intentionally distinct from the recommendation-tier colors (`src/lib/recommendation-tiers.ts`).

Each category carries a stable `color` slot (`Category.color`, a palette index) assigned **sequentially in dataset order** by `assignCategoryColors` (`src/stores/categories.ts`) at dataset init, reset, and runtime category creation, and backfilled onto older data by `normalizeCategoryColors`. Because every palette has **12 colors**, categories stay distinct only up to 12 — that is the deliberate ceiling of the current approach (no reuse *within* 12; a larger palette would raise the limit). `useCategoryPalette` prefers the category's stored slot and only falls back to the key hash for ad-hoc keys (e.g. palette-preview names), so the seam needs no per-component wiring.

The **active palette** is a persisted user choice:

- `src/stores/palette.ts` — `$activePaletteId` (a `@nanostores/persistent` `jsonStore`, persisted under `remindit:active-palette`), plus `setActivePalette(id)` / `getActivePalette()`. Defaults to `defaultPaletteId` from the pool.
- `src/hooks/use-category-palette.ts` — `useCategoryPalette(key, overrideSlot?)` subscribes to the active palette and returns `categoryPalette(...)` for it, so any consumer recolors live when the choice changes. It resolves the category's stored slot via the `$categoryById` Map selector (falling back to the key hash for non-category keys) and passes it as `overrideSlot`; subscribing to `$categories` means a color-slot change recolors mounted chips. `ItemButton` and `ShoppingItem` use this hook.
- Pick the active palette in **Profile** via `PaletteChooser` (`src/components/palette-chooser.tsx`): an inline Shark `Listbox` of the pool with a 12-swatch preview per option and a live sample-chip preview above the list. Selection calls `setActivePalette`.
- **`ItemCatalog`** (`src/components/item-catalog.tsx`) — the right-hand browse/select panel. Renders the Shark `Accordion` wrapper (`src/components/ui/accordion`; multiple, only the first two categories open by default) of `ItemButton`s grouped by category from `$catalogByCategory`, all wired through the `useCatalog` hook (`src/hooks/use-catalog.ts`). Clicking toggles list membership via `addToList` / `removeFromListByItemId` — the itemId → entryId resolution lives inside `list.ts`, not the panel — and each toggle runs an item-travel View Transition (see [Item-travel View Transitions](#item-travel-view-transitions)).

### Quick add

The shopping-list panel's floating `+` button opens a `QuickAddDialog` (`src/components/quick-add-dialog.tsx`) — a Shark UI `Dialog` containing a grouped `Autocomplete` (`@shark/autocomplete`, added via the registry) for fast list entry.

- **Source list** — built from the same stores the available-items panel uses, so ordering matches: categories ordered by `frequencyRank` (most-frequent first), items in catalog order (`$catalogByCategory`). When `$recommendations.length >= 10` it shows **only** recommended items (grouped by category, ordered by recommendation score within the category); otherwise it shows the full catalog.
- **Grouping** — one `AutocompleteGroup` per category (`heading` = category name); choices are `AutocompleteItem`s keyed by item **id** (not the label) so selection adds the correct item via `addToList`.
- **Create new item** — always available when the typed value (≥3 chars, enforced guard) matches no catalog item: an `Add "<name>"` row appears (an ordinary autocomplete option — click or keyboard-select), and a category-pill row below the list (`Add "<name>" to <Category>`) lets the user pick the target category. The create target is the **user-chosen** category (defaults to `uncategorized`, or the first category when the sentinel is absent) — not a fixed id. Tapping a creatable pill creates + closes immediately; pressing Enter on the input creates from the typed value under the selected pill. All paths run `createItemAndAddToList` (create + add to list). A hint below the input reminds users to reach 10 items to unlock personalized recommendations.
- **Closing** — selecting any item (or creating one) adds it to the list and closes the dialog; the input is auto-focused when the dialog opens.

### Item-travel View Transitions

`src/hooks/use-item-travel-transition.ts` drives a shared-element morph between the catalog panel and the shopping list with the native View Transitions API (used directly — the catalog keeps every item mounted, so React's delete+insert share detection never fires). Chips on both sides carry a `travelTargetId` prop (the itemId) rendered as `data-vt-catalog` / `data-vt-list` attributes; `runTravel(itemId, sourceEl, mutate)` tags the source node with a `view-transition-name`, runs the store mutation inside `startViewTransition` (`flushSync`), tags the opposite-side target, and clears the names afterwards. When the API is unavailable or `prefers-reduced-motion` is set, `isSupported` is false and callers fall back to their own CSS enter/exit animations (`shopping-list-panel.tsx`).

### Catalog management UI

`/catalog` (`src/views/catalog.tsx`) renders every category — including empty ones and the `uncategorized` sentinel — from `$catalogByCategoryAll` as `CategorySection`s from `src/components/catalog/`. Adding/editing goes through `ItemDialog` / `CategoryDialog` (name, category reassignment, purchase frequency via `category-frequency-menu.tsx`). Deletion differs by input modality: on mobile, rows are `swipeable-item-row.tsx` (swipe left to reveal Delete — touch only, `trackMouse: false` — with a confirm `AlertDialog`); on desktop, tap/double-click to edit and the per-row `⋯` menu to delete. All destructive flows go through the `commands.ts` cascades (see Invariants).

## Typography

The application uses the self-hosted **Atkinson Hyperlegible Next** variable font from Fontsource. The font is imported from `src/index.tsx` and its `200–800` weight range is exposed through the global `font-sans` theme token in `src/styles/globals.css`. The `body` applies `font-sans`, so feature components inherit the application font without local font declarations. Full type scale and conventions: [`DESIGN.md` §3](../DESIGN.md).

Install or update it with:

```bash
bun add @fontsource-variable/atkinson-hyperlegible-next
```

## State architecture

App state lives in **framework-agnostic [nanostores](https://github.com/nanostores/nanostores)** under `src/stores/`. No React imports there — components consume stores via `@nanostores/react`'s `useStore`. This keeps the store layer reusable and easy to test.

All collections are persisted to `localStorage` with `@nanostores/persistent` (key prefix `remindit:`).

### Model: Catalog + active list

- **Catalog** (`$catalog`) — the master pool of every known item `{ id, name, categoryId }`.
- **List** (`$list`) — the currently active shopping list. Each entry `{ id, itemId, checked, addedAt }` references a catalog item and tracks a `checked` state for shopping progress.
- **Categories** (`$categories`) — `{ id, name, frequency, color? }`. An `uncategorized` sentinel category always exists and is the destination when another category is deleted (so items are never orphaned). `frequency` records how often the category is typically bought (see below); `color` is the stable palette slot assigned by `assignCategoryColors` (see the categorical palette section).
- **History** (`$history`) — a pure log of shopping events `{ id, action: 'add' | 'remove', itemId, itemName, categoryId, categoryName, timestamp }`. `categoryName` is a snapshot of the category's display name taken at log time (falls back to `"Uncategorized"`).
- **User** (`$user`) — `UserProfile { username, firstName, lastName, email, avatar }`. `username` is the only mandatory field and defaults to a random value (`generate-random-username`); `email` is reserved for future multi-user/sync work. `avatar` is a **self-contained inline SVG** (`data:` URI) generated by DiceBear (`personas` style) during onboarding via `src/lib/profile-generator.ts`, or a local initials fallback (`localAvatar` in `user.ts`, used by `randomUser()`) — no network request, in keeping with the local-first positioning. The avatar stays editable after onboarding in **Profile** via `AvatarPicker` (`src/components/avatar-picker.tsx`): a 4×3 grid of 12 random DiceBear `personas` options with a reroll, each a self-contained `data:` URI.

### Store modules (`src/stores/`)

| File             | Exposes                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`       | Shared types + `UNCATEGORIZED_ID` / naming constants                                                                                                    |
| `persistence.ts` | `STORAGE_KEYS` (every `remindit:*` localStorage key) + `jsonStore` (shared `persistentJSON` factory — see [Persistence layer](#persistence-layer))      |
| `categories.ts`  | `$categories`, `addCategory`, `renameCategory`, `updateCategory`, `getCategory`, `ensureUncategorizedExists`, `assignCategoryColors` / `normalizeCategoryColors` (palette color slots), `normalizeCategoryFrequencies` |
| `catalog.ts`     | `$catalog`, `addCatalogItem`, `updateCatalogItem`, `renameCatalogItem`, `reassignItemsToCategory`, `getCatalogItem`                                     |
| `list.ts`        | `$list`, `addToList`, `removeFromList`, `removeFromListByItemId`, `setEntryChecked`, `clearList`, `removeListEntriesForItem`                            |
| `history.ts`     | `$history`, `logHistory`, `clearHistory`                                                                                                                |
| `commands.ts`    | Cross-store flows — `deleteCategoryWithReassign`, `deleteCatalogItemWithCascade`, `createItemAndAddToList`, full factory wipe `wipeAllData` (used by the local-data erase), backup restore `restoreLocalData` (see below) |
| `user.ts`        | `$user`, `getUser`, `updateUser`, `randomUser` (offline initials fallback via `localAvatar`)                                                            |
| `selectors.ts`   | computed `$itemsByCategory`, `$categoryById`, `$activeCategoryIds`, `$listCount`, `$checkedCount`, `$catalogView`, `$selectedView`, `$selectedOrdered`, `$listItemIds`, `$catalogByCategory`, `$catalogByCategoryAll`, `$recommendations`, `$recommendationsByItemId`, `$itemDetail(itemId)` |
| `recommender.ts` | `computeItemStats`, `getExpectedInterval`, `scoreItem`, `computeRecommendations`, `FREQ_TO_DAYS`                                                        |
| `ui.ts`          | UI-preference state — `$accordionOpen`, `setAccordionOpen` (persists the available-items panel's accordion open-state) + list sort — `SelectedSort`, `$selectedSort`, `SELECTED_SORT_ORDER`, `cycleSelectedSort` (see [List sort feature](#list-sort-feature)) |
| `palette.ts`     | Active categorical-palette selection — `$activePaletteId`, `getActivePalette`, `setActivePalette` (persisted to `localStorage` under `remindit:active-palette`) |
| `onboarding.ts`  | Onboarding/dataset state — `$onboarded`, `$selectedDatasetId`, `isOnboarded`, `setOnboarded`, `getSelectedDatasetId`, `setSelectedDataset`, `resolveSelectedDataset` |
| `pwa-install.ts` | Install-prompt state — `$canInstall`, `$installed`, `$installDismissed`, `$installLater`, `$manualPlatform`, `$showInstallBanner`, `initPwaInstall`, `installApp`, `dismissInstall`, `dismissLater` |
| `theme.ts`       | `$theme` (`ThemeMode`: `light \| dark \| system`), `initTheme` (see [Theme store](#theme-store))                                                        |
| `index.ts`       | Barrel exports (no side effects) + the bootstrap API: `initStores()`, `completeOnboarding()`, `setupDevLogging()`                                       |

Import store atoms/actions from the barrel: `import { $list, addToList } from "@/stores"`.

**Cross-store flows live in `commands.ts`.** Store modules own a *single resource* and never import a sibling store's action functions; anything that composes two or more stores for one user action lives in `src/stores/commands.ts` (e.g. deleting a category reassigns its items, deleting a catalog item cascades list entries). This keeps the store call graph acyclic. **One sanctioned exception:** `list.ts` imports `logHistory` from `./history` — history logging is intrinsic to list add/remove (the list is the only history writer), as documented in the `list.ts` header.

**React hooks are NOT exported from the barrel.** `useCatalog`, `useShoppingList`, `usePwaInstall` live in `src/hooks/` (importing store atoms), and `useDrawerContext` comes from `src/components/drawer-context.tsx` (the `useDrawer` name is a local alias inside `item-detail-drawer.tsx`). Import hooks directly: `import { useCatalog } from "@/hooks/use-catalog"` — never through `@/stores`.

### Persistence layer

`src/stores/persistence.ts` centralizes storage wiring: `STORAGE_KEYS` maps every `remindit:*` localStorage key (a rename touches exactly one file), and `jsonStore(key, initial)` wraps `@nanostores/persistent`'s `persistentJSON` so every data store shares one serialization strategy. Store modules import these instead of calling `@nanostores/persistent` directly or hardcoding key literals; `theme.ts` is the one raw-`persistentAtom` user (same keys, legacy-tolerant decode).

### Theme store

`src/stores/theme.ts` — `$theme` (`ThemeMode`: `light | dark | system`, persisted under `remindit:theme`). `initTheme()` applies the active theme to `<html>` (class + `colorScheme`), subscribes to store changes, and tracks the OS `prefers-color-scheme` while in `system` mode. `src/index.tsx` calls `initTheme()` explicitly **before first paint** to avoid a flash of the wrong palette. The theme menu (`src/components/theme-menu.tsx`) writes through `$theme.set` (wrapped locally as `setTheme` in `theme-toggle.tsx`).

### Onboarding gate

`src/stores/onboarding.ts` — `$onboarded` (persisted `remindit:onboarded`) and `$selectedDatasetId` (persisted `remindit:selected-dataset`), with `isOnboarded` / `setOnboarded` / `getSelectedDatasetId` / `setSelectedDataset` / `resolveSelectedDataset` (stored choice → build-time `PUBLIC_DATASET` → registered default). The router's `Layout` redirects to `/onboarding` while not onboarded; `completeOnboarding(profile, datasetId)` in `src/stores/index.ts` seeds, persists the profile + dataset choice, and flips the flag. The local-data erase path resets `$onboarded` so the gate re-engages. Onboarding is a 4-step wizard: **language** (step 1, `LanguageChooser` — see [Internationalization](#internationalization-i18n)) → welcome demo video → profile → dataset.

### Internationalization (i18n)

UI strings are managed with **Paraglide JS v2** (`@inlang/paraglide-js`, compiler-first i18n). Plan & decisions: [`I18N-PLAN.md`](./I18N-PLAN.md).

- **Source of truth:** `messages/{locale}.json` (inlang message format, flat files — `en` is `baseLocale`, `ro` shipped). The compiler generates `src/paraglide/` (self-gitignored) into typed, tree-shakable ESM `m.*` functions.
- **Compilation:** the official `paraglideRspackPlugin` runs inside `rsbuild.config.ts` (`tools.rspack.plugins`), so dev **watch-compiles** message edits; `bun run i18n:compile` (programmatic `compile()` in `scripts/compile-i18n.ts`, sharing `PARAGLIDE_COMPILER_OPTIONS`) covers entry points that run outside the bundler — it is chained into `typecheck`, `test`, `test:quick`, `test:changed`, and `test:watch`.
- **Usage:** `import { m } from "@/paraglide/messages"` then `m.key({ param })` — no provider/context, works alongside nanostores. Resolve messages **inside render bodies or functions only** — a module-scope `m.*` call freezes the string at import time. Plurals use the array-of-match variants syntax (see `I18N-PLAN.md`); the ICU `#` shorthand is **not** supported — repeat the variable (`{count}`) inside variants.
- **Locale resolution:** strategy chain `["localStorage", "preferredLanguage", "baseLocale"]` with `localStorageKey: "remindit:locale"` — persisted user choice first, then browser language, then English. `src/index.tsx` sets `document.documentElement.lang` before first paint (mirrors `initTheme()`).
- **Language UX:** chosen in onboarding **step 1** and switchable in the **Profile** language card via `LanguageChooser` (`src/components/language-chooser.tsx`, locales listed in `APP_LOCALES` in `src/lib/locale.ts`). Switching persists the choice and performs a **full document reload** (deliberate — all state is persisted; the SW-served shell makes it fast). `localStorage.clear()` in the erase path wipes the choice, so erase re-triggers the language prompt.
- **Data is not UI:** catalog item names, category names, dataset names, and the `uncategorized` sentinel stay **data** (seeded/user-entered) — never wrapped in messages. Locale native names in `APP_LOCALES` are likewise static.
- **Adding a language** (e.g. German): add the code to `locales` in `project.inlang/settings.json`, create + translate `messages/{locale}.json`, add an `APP_LOCALES` entry, run `bun run i18n:compile`.

### List sort feature

`src/stores/ui.ts` — `$selectedSort` (persisted under `remindit:selected-sort`) with 4 modes in `SELECTED_SORT_ORDER`: `default` (list insertion order), `category-name`, `name`, `last-added`. `cycleSelectedSort` advances the single floating sort button in the shopping-list panel (the store owns the state machine; the view just calls it). `$selectedOrdered` (`selectors.ts`) applies the active mode to `$selectedView`; the button's icon/label map lives in `shopping-list-panel.tsx`.

### Invariants

- **History logs only `add`/`remove`-from-list.** `addToList` → `logHistory('add')`; `removeFromList` → `logHistory('remove')`. Editing or deleting catalog items and deleting/renaming categories deliberately **do not** write history — those callers simply never call `logHistory`.
- **Deleting a catalog item** also drops any active list entries referencing it (cascade, no history).
- **Deleting a category** reassigns its catalog items to `uncategorized` (no history, no orphans). The sentinel itself cannot be deleted or renamed.

### Category frequency

Each category carries a `frequency` (`CategoryFrequency`, exported from `types.ts`) describing how often its items are typically purchased. Allowed slugs:

| Slug             | Meaning            |
| ---------------- | ------------------ |
| `daily`          | every day          |
| `every-2-3-days` | every 2–3 days     |
| `weekly`         | every week         |
| `every-2-weeks`  | every 2 weeks      |
| `monthly`        | every month        |
| `every-3-months` | every 3 months     |
| `seldom`         | rarely             |
| `unknown`        | not yet classified |

`addCategory(name, frequency?)` defaults to `"unknown"`, as does the sentinel. Seeded categories get their `frequency` from the dataset loader: the **English dataset carries curated values** (`FREQUENCY_BY_CATEGORY` in `seed/index.ts`); other datasets fall back to `"unknown"` (see below). `normalizeCategoryFrequencies()` (called by `initStores()`) backfills a valid `frequency` onto any category persisted before this field existed, so legacy `localStorage` data stays well-formed.

### Recommendations

A computed store `$recommendations` provides item recommendations based on shopping history. The algorithm scores each catalog item by how "overdue" it is relative to its normal purchase cycle.

**Formula:**

```
score = due_ratio × confidence_factor
```

Where:
- `due_ratio` = `days_since_last_added / expected_interval`
- `expected_interval` = item's median purchase interval (if ≥3 purchases) → category's frequency default → 14-day global fallback
- `confidence_factor` = `min(purchase_count / 5, 1)` — penalizes sparse history

**Exclusions:** items in `seldom`-frequency categories, items currently on the active list, and items with **zero purchase history** are never recommended.

**Tiers:** `"overdue"` (due_ratio > 1.0), `"soon"` (due_ratio > 0.7), `"frequent"` (everything else) — so an item at exactly 0.7 is still `frequent`.

Pure functions in `recommender.ts` are framework-agnostic and independently testable. `$recommendations` (in `selectors.ts`) auto-recomputes when `$history`, `$catalog`, `$categories`, or `$list` change.

### Seeding

On first run the app shows **onboarding** instead of seeding. `initStores()` is an explicit bootstrap call made once from `src/index.tsx` (the `src/stores/index.ts` barrel has **no side effects** — importing a store never triggers seeding or logging). It is a no-op until the user is **onboarded** (`remindit:onboarded`); once onboarded, it seeds `$categories`/`$catalog` only when **no persisted catalog record exists** (`remindit:catalog` absent from `localStorage` — persisted-record absence, not store emptiness, is the first-run marker, so a user who deletes every catalog item is not re-seeded on reload). The dataset comes from `resolveSelectedDataset()` — the persisted onboarding choice (`remindit:selected-dataset`), falling back to the `PUBLIC_DATASET` env var, then `DEFAULT_DATASET_ID` = `minimal`. `initStores` never seeds a user. Onboarding completes via `completeOnboarding(profile, datasetId)` (in `src/stores/index.ts`), which seeds the catalog/history, persists the profile, and flips the onboarded flag.

#### Seed datasets

The repo-root `seed/` directory is a tracked, extensible registry of sample catalogs (`seed/index.ts`):

- `DATASETS: DatasetMeta[]` — each entry is `{ id, name, file }` (stable key, human label, seed-relative filename).
- `DEFAULT_DATASET_ID` — the starter dataset (`minimal`) onboarding preselects, and the final fallback of the resolution chain (stored choice → `PUBLIC_DATASET` → default).
- `resolveDatasetId(raw)` — validates a raw dataset id (typically from `PUBLIC_DATASET`) against `DATASETS`, returning it or falling back to `DEFAULT_DATASET_ID` with a warning.
- `getDataset(id)` — returns `{ rawItems, categories, catalog }` for any registered dataset.

**Add a dataset:** drop its JSON into `seed/` and append a `DatasetMeta` to `DATASETS`. The loader normalizes it automatically (deterministic ids via the same FNV-1a scheme used by the history fixture).

**Items without a category:** any row whose `category_name` is empty/whitespace is assigned to the `uncategorized` sentinel (`id: "uncategorized"`) and **no empty-named category is created** — consistent with how `removeCategory` already reassigns orphans to `uncategorized`. Curated `frequency` values live in `FREQUENCY_BY_CATEGORY` (English set only); other datasets fall back to `"unknown"`.

#### Selecting the seeded dataset

The catalog is seeded from the **persisted dataset choice** (`remindit:selected-dataset`, set during onboarding or reset & reseed). `PUBLIC_DATASET` is only the **fallback** for when no choice is persisted (fresh installs). It is a **public** variable (Rsbuild exposes any `PUBLIC_`-prefixed var to client code via `import.meta.env`) defined in a `.env` file at the project root. Copy `.env.example` to `.env` and set:

```sh
PUBLIC_DATASET=rick_morty
```

Valid values are the `id`s registered in `DATASETS`: `minimal`, `items_categories`, `leo_romanian`, `rick_morty`. An empty or unknown value falls back to `DEFAULT_DATASET_ID` and prints a warning. Because Rsbuild inlines env vars at build time, **restart the dev server (or rebuild) after changing the dataset.**

#### Seeding history (first run)

In addition to the catalog, both seeding paths (`initStores` first-run and `seedFromDataset`) generate a simulated **6-month shopping history** into `$history`, so the recommender has data to surface for new users (`initStores` only does this while history is empty). Always on; disable by setting `PUBLIC_SEED_HISTORY=0` in `.env`.

The generator lives in `seed/history.ts` (`generateShoppingHistory`) and is **frequency-aware** and **reproducible** (seeded `mulberry32` PRNG, default seed `42`):

- **Adds** follow each item's category `frequency` via the same `FREQ_TO_DAYS` map the recommender uses (`recommender.ts`), so a weekly item is repurchased roughly every 7 days, monthly every ~30, etc. Jitter (±20%) plus a per-item phase offset keeps the last-purchase dates spread, yielding a realistic mix of *overdue / soon / frequent* recommendations at `now`. For the shipped datasets this naturally lands at ~1–10 additions per day.
- **Shopping sessions** happen every 2–3 days. Each session removes most of the items currently on the list (bought), clustered within a 1–3-hour window; **0–3 items are intentionally left over** (still on the list with no trailing `remove` event — the realistic "didn't get to it" outcome).
- History is written in a **single `$history.set(...)`** (not one `logHistory` call per event) so first-run seeding stays cheap.
- Output is deterministic for a given `{catalog, categories, days, seed}`, so recommendations are reproducible across runs.

#### Reset & reseed (runtime)

Beyond the build-time `PUBLIC_DATASET` fallback, the app offers a user-initiated **reset & reseed** from **Profile**. It wipes all user data — `$list`, `$history`, `$catalog`, `$categories` — then repopulates `$catalog`/`$categories` from a dataset the user picks at reset time (one of the four registered in `seed/index.ts`), regenerating a fresh first-run history. The theme preference (`remindit:theme`) is deliberately preserved. This is powered by `seedFromDataset(datasetId, profile?)` in `src/stores/index.ts`, which **always overwrites** — including `$user`, which it sets to `profile ?? randomUser()`. The Profile path keeps the user's profile by passing `getUser()` back in (`seedFromDataset(dataset, getUser())`); calls without a profile get a synchronous offline fallback profile (`randomUser`).

### Local data download, import & erase

The "My local data" card in **Profile** (`src/views/profile.tsx`) exposes `src/lib/local-data.ts`:

- **Download** — `downloadLocalData()` serializes every persisted store into a versioned JSON envelope (`LocalDataEnvelope`, app version + ISO timestamp) and triggers a browser download via Blob/object URL.
- **Import (restore from backup)** — `readLocalDataFile(file)` rejects files larger than **10 MB**, then parses the JSON via `parseLocalDataEnvelope()`, which is **strict on envelope structure** (version, exportedAt, `data` object, array-typed collections → anything else throws `LocalDataValidationError`) and **tolerant on values** so older exports import cleanly: theme/palette/sort fall back to defaults, user fields coerce to `""`, and collection rows are validated **per collection** — each row is rebuilt field-by-field (unknown fields stripped, safe fields coerced: invalid `categoryId` → `uncategorized`, non-string display text → `""`), and a row that is truly unusable (catalog/list/history rows missing their `id`/`itemId` keys, history actions outside `add`/`remove`) is dropped instead of poisoning the store. Avatars are accepted only as `data:image/` URIs — anything else becomes `""`, preserving the local-first invariant (an https URL would issue a network request when rendered). On success the view opens a confirm dialog (export date + backup version, destructive warning, plus a warning line when the backup's major version is newer than the running app — `isNewerBackupVersion()`) and runs `restoreLocalData(envelope)` — the cross-store command in `commands.ts` that overwrites all 12 atoms, **forces `$onboarded` to true** (a restored backup must never bounce to the gate), and re-runs the seeding normalizers (`ensureUncategorizedExists`, `normalizeCategoryFrequencies`, `normalizeCategoryColors`). It deliberately skips `localStorage.clear()` — each persistent atom overwrites its own key, and clearing would also wipe the locale choice the envelope doesn't capture (language is UI, not data). Profile shows a success ack then navigates home; **onboarding step 2** offers the same restore ("I have a backup file") which replaces the profile + dataset steps entirely. Both views guard against out-of-order file picks with a latest-pick token and cancel the success/ack timers on close or unmount.
- **Erase** — `eraseLocalData()` is a full factory wipe: resets every store atom (including theme, palette, sort, and `$onboarded`) and calls `localStorage.clear()` so no `remindit:` residue survives; the onboarding gate in `router.tsx` then redirects to `/onboarding`. The wipe lives in the store layer as `wipeAllData()` in `commands.ts` (`local-data.ts` is a thin wrapper over it).

### Dev tooling

In dev builds (`import.meta.env.DEV`), `setupDevLogging()` — called from `src/index.tsx` — attaches the **five** core data stores (`$catalog`, `$list`, `$categories`, `$history`, `$user`) to `@nanostores/logger` for console inspection.

### Demo videos

The feature-demo video set (`public/demos/*.mp4`, light + dark variants) is generated by `bun run demos` from `scripts/demo-scenarios.ts` and can be embedded in app content via `/demos/…` through `DemoVideo` (`src/components/demo-video.tsx`) — muted and looping, autoplaying while ≥50% in the viewport (`useAutoplayInView`) and pausing out of view, falling back to native controls under `prefers-reduced-motion` or when the browser blocks `play()`. Docs: [`DEMOS.md`](./DEMOS.md).

### Code quality (Biome)

- `bun run lint` — lint only (`biome lint`).
- `bun run format` — format only (`biome format --write`).
- `bun run check` — full fix: `biome check --write --unsafe` — lints, formats, **organizes imports** (`biome.json: assist.actions.source.organizeImports: "on"`), and sorts Tailwind classes (`linter.domains.tailwind`). Use this before committing after import changes; `lint` alone does not fix imports.

### Type checking (tsc)

- `bun run typecheck` — `i18n:compile && tsc --noEmit --pretty` (TypeScript 7's native compiler): the i18n compile runs first because `src/paraglide/` is gitignored — without fresh generated output `tsc` would fail on missing `m.*` declarations; then it static-checks the whole project without emitting, reporting every type error with source context.
- Run it after type-relevant changes (store types, component props, shared types) and before committing — it catches what runtime tests don't (broken prop contracts, stale type imports). It is also the **first step of the `test:pre` release gate**, so a type error blocks a release the same way a failing test does.

### Usage in React

```tsx
import { useStore } from "@nanostores/react";
import { $itemsByCategory, addToList, setEntryChecked } from "@/stores";

function ShoppingList() {
  const groups = useStore($itemsByCategory);
  return groups.map(({ category, items }) => (
    <section key={category.id}>
      <h2>{category.name}</h2>
      {items.map(({ entry, item }) => (
        <label key={entry.id}>
          <input
            type="checkbox"
            checked={entry.checked}
            onChange={(e) => setEntryChecked(entry.id, e.target.checked)}
          />
          {item.name}
        </label>
      ))}
    </section>
  ));
}
```

## Testing

Progressive suites — cheap tests run often, expensive ones at the gates. Pick the one that matches the moment:

| Suite | Runs | Command | When |
|---|---|---|---|
| **quick** | Pure helpers (`src/lib/**`) + store/command/selector layer (`tests/stores/**`) — the data model & core logic, no UI rendering | `bun run test:quick` | Dev loop after a logic change |
| **all** | Every Rstest test (adds `src/components/**`, `src/hooks/**`, `tests/index`, `tests/seed*`) | `bun run test` | Pre-commit / CI |
| **pre-release** | `typecheck` + `all` + Playwright dev (`e2e/`) + production precache (`e2e-prod/`) | `bun run test:pre` | Release / main CI |

- `bun run test:changed` is change-aware — it runs Rstest tests related to changed files, falling back to the full suite when the related set can't be resolved. (In this Rspack setup it currently runs the full suite, so use `test:quick` for the reliable fast dev gate.)
- `bun run test:e2e` runs Playwright against the dev server; `bun run test:e2e:prod` runs the offline-precache specs against a production `preview` (so it **builds first** — the `e2e-prod/` specs need a real bundle, not the dev server).
- The quick config (`rstest.quick.config.ts`) reuses the base Rstest config and only narrows `include`, so it can't drift on environment/setup.

Guidance:

- **Keep the store layer `tests/stores/**` unit-tested** — it is stable and cheap to test, and is the core of the `quick` gate.
- **Component unit tests are intentionally postponed** until they are actually required. While the UI is actively evolving (e.g. refactoring panels), maintaining per-component unit tests is churn with little payoff — delete or skip them rather than keeping them in sync with each change. The component/App render tests that exist today (`src/components/**/*.test.tsx`, `tests/index.test.tsx`) run in the `all` suite.
