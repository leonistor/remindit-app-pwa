# development

## Application Layout

The app uses a single-route layout (`src/router.tsx`) with a top menu bar, a content area (`<Outlet />`), and a discreet version footer (hidden on the main shopping view).

```
DrawerProvider
├── Menu (h-16 bar: logo, nav links, theme toggle)
├── <Outlet /> (page content)
├── ItemDetailDrawer (context-managed, hidden by default)
└── Footer (hidden on "/")
```

### Main view (`/`)

A resizable two-panel split (`ShoppingPanels`):

| Panel | Content |
|---|---|
| Left (30%) | Items on the active shopping list (toggle group for display/ordering) |
| Right (70%) | `ItemCatalog` — catalog items grouped by category (info tooltip for recommendation codes) |

Catalog items show recommendation badges (overdue/soon dots) based on the computed `$recommendations` store.

### Item detail drawer

A context-managed drawer (`DrawerProvider` + `ItemDetailDrawer`) sits at the Layout level. `openDrawer(itemId)` (via `useDrawer()` / `useDrawerContext()`) is **reserved for Phase 3** and is intentionally not wired into the item UI yet — `ItemDetailDrawer` currently renders placeholder content. Phase 3 will populate it with item attributes (photo, quantity, price).

### Routes

| Path | View | Description |
|---|---|---|
| `/` | ShoppingPanels | Main shopping list + catalog |
| `/catalog` | CatalogView | Manage catalog items |
| `/history` | HistoryView | View shopping history |
| `/settings` | SettingsView | User preferences |
| `/about` | AboutView | About the app |
| `/help` | HelpView | Usage help |

### PWA manifest

The installable web manifest is defined in `pwa-manifest.config.ts` (the `WEB_APP_MANIFEST` object), **not** inline in `rsbuild.config.ts`. Brand color for both the manifest and the generated icons lives in that same file as `PWA_THEME_COLOR` / `PWA_BACKGROUND_COLOR` — both default to the **neutral app primary** (`#262626`, background `#ffffff`), reconciled with the neutral UI chrome. `scripts/generate-favicons.ts` imports those same constants when regenerating icons, so the manifest and favicons stay in sync. The master icon SVGs (`public/remindit-icon.svg`, `public/remindit-icon-maskable.svg`) carry the same `#262626` fill.

## UI components (Shark UI)

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
transparent base for components that supply their own color via the categorical palette), plus the
project-specific `item-button` and `toggle-tooltip`. **Do not run `shadcn add @shark/button`** — the
registry HEAD drops those variants and would break the build. Item/category color lives in
`src/lib/category-palette.ts` (qualitative, colorblind-safe) and is intentionally distinct from the
recommendation-tier colors in `src/lib/recommendation-tiers.ts`.
See [`DEV-COMPONENTS.md`](./DEV-COMPONENTS.md) for the full registry-vs-custom split and the latest
upstream update-check findings.

### Item display components

Two feature components render items; pick the right one for the context:

- **`ItemButton`** (`src/components/ui/custom/item-button.tsx`) — used for *available* catalog items. Shows only the item name and supports `selectable` / `removable` / `recommendation` purposes. Color is **decoupled from `Button` variants**: it renders `<Button variant="bare">` and applies a **solid palette background** (the full categorical hue) with a WCAG-contrast text color, via `categoryKey` (the category id; keyed by id so it matches the shopping list) resolved through `useCategoryPalette` (see below). `paletteOverride` (a palette index) allows a future user-assigned color. `isSelected` (or the `removable`/`recommendation` purpose) drives the emphasized solid treatment; a `selectable` item that is already selected uses the muted `dimmed` tint. `animationState` (`enter`/`exit`) hooks the `item-enter`/`item-exit` keyframes. The recommendation-tier dot stays a separate semantic concern (see `recommendation-tiers.ts`).
- **`ShoppingItem`** (`src/components/shopping-item.tsx`) — used for *selected* list items. Renders a Shark UI `Badge` (category label, defaults to `"Uncategorized"`) above the item name, colored by the shared categorical palette (via `useCategoryPalette`), and the chip itself uses the selected/emphasized palette treatment (the button is `bare` + palette tokens, not the `success` variant). Both key off `categoryId` so the color matches the catalog for the same category. Props: `name`, `categoryName?`, **`categoryId?`** (stable id used as the palette key; falls back to `categoryName`), **`showCategory`** (boolean, defaults to `true` — hides the Badge when `false`), `disabled?`, `onClick?`, `className?`. Left-aligned via `items-start`.

### Categorical color palette

Category/item colors come from a **pool of palettes** (`src/lib/palettes.ts`: `PALETTE_POOL`, `getPalette`, `defaultPalette`). `src/lib/category-palette.ts` exposes the pure `categoryPalette(key, overrideSlot?, palette = defaultPalette)` which maps a category id (or explicit palette index) to an `ItemPalette` of CSS-var style tokens. It is intentionally distinct from the recommendation-tier colors (`src/lib/recommendation-tiers.ts`).

The **active palette** is a persisted user choice:

- `src/stores/palette.ts` — `$activePaletteId` (a `@nanostores/persistent` `jsonStore`, persisted under `remindit:active-palette`), plus `setActivePalette(id)` / `getActivePalette()`. Defaults to `defaultPaletteId` from the pool.
- `src/hooks/use-category-palette.ts` — `useCategoryPalette(key, overrideSlot?)` subscribes to the active palette and returns `categoryPalette(...)` for it, so any consumer recolors live when the choice changes. `ItemButton` and `ShoppingItem` use this hook.
- Pick the active palette in **Settings** via `PaletteChooser` (`src/components/palette-chooser.tsx`): an inline Shark `Listbox` of the pool with a 12-swatch preview per option and a live sample-chip preview above the list. Selection calls `setActivePalette`.
- **`ItemCatalog`** (`src/components/item-catalog.tsx`) — the right-hand browse/select panel. Renders an Ark UI `Accordion` (multiple, all categories open by default) of `ItemButton`s grouped by category from `$catalogByCategory`. Clicking toggles list membership via `addToList` / `removeFromList` (resolving item id → entry id through `$selectedView`). Shows a `ToggleTooltip` with recommendation colour codes.

## Typography

The application uses the self-hosted **Atkinson Hyperlegible Next** variable font from Fontsource. The font is imported from `src/index.tsx` and its `200–800` weight range is exposed through the global `font-sans` theme token in `src/styles/globals.css`. The `body` applies `font-sans`, so feature components inherit the application font without local font declarations.

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
- **Categories** (`$categories`) — `{ id, name, frequency }`. An `uncategorized` sentinel category always exists and is the destination when another category is deleted (so items are never orphaned). `frequency` records how often the category is typically bought (see below).
- **History** (`$history`) — a pure log of shopping events `{ id, action: 'add' | 'remove', itemId, itemName, categoryId, timestamp }`.
- **User** (`$user`) — `{ name, photo }`, assigned random defaults on first run. `photo` is a **locally generated** SVG initials avatar (a `data:` URI from `randomUser()` in `user.ts`) — no network request, in keeping with the local-first positioning.

### Store modules (`src/stores/`)

| File            | Exposes                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | Shared types + `UNCATEGORIZED_ID` / naming constants                                                                                                    |
| `categories.ts` | `$categories`, `addCategory`, `renameCategory`, `removeCategory`, `getCategory`, `ensureUncategorizedExists`                                            |
| `catalog.ts`    | `$catalog`, `addCatalogItem`, `updateCatalogItem`, `removeCatalogItem`, `getCatalogItem`                                                                |
| `list.ts`       | `$list`, `addToList`, `removeFromList`, `setEntryChecked`, `clearList`, `createItemAndAddToList`, `removeListEntriesForItem`                            |
| `history.ts`    | `$history`, `logHistory`, `clearHistory`                                                                                                                |
| `user.ts`       | `$user`, `getUser`, `updateUser`, `randomUser`                                                                                                          |
| `selectors.ts`  | computed `$itemsByCategory`, `$activeCategoryIds`, `$listCount`, `$checkedCount`, `$catalogView`, `$selectedView`, `$listItemIds`, `$catalogByCategory`, `$recommendations` |
| `recommender.ts`| `computeItemStats`, `getExpectedInterval`, `scoreItem`, `computeRecommendations`, `FREQ_TO_DAYS` |
| `ui.ts`         | UI-preference state — `$accordionOpen`, `setAccordionOpen` (persists the available-items panel's accordion open-state to `localStorage`) |
| `palette.ts`    | Active categorical-palette selection — `$activePaletteId`, `getActivePalette`, `setActivePalette` (persisted to `localStorage` under `remindit:active-palette`) |
| `index.ts`      | Barrel exports + `initStores()` (seeds sample data, random user, dev logger)                                                                    |

Import everything from the barrel: `import { $list, addToList } from "@/stores"`.

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

`addCategory(name, frequency?)` defaults to `"unknown"`. The sentinel and all sample-seeded categories start as `"unknown"`. `normalizeCategoryFrequencies()` (called by `initStores()`) backfills a valid `frequency` onto any category persisted before this field existed, so legacy `localStorage` data stays well-formed.

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

**Exclusions:** items in `seldom`-frequency categories and items currently on the active list are never recommended.

**Tiers:** `"overdue"` (due_ratio > 1.0), `"soon"` (0.7–1.0), `"frequent"` (<0.7).

Pure functions in `recommender.ts` are framework-agnostic and independently testable. `$recommendations` (in `selectors.ts`) auto-recomputes when `$history`, `$catalog`, `$categories`, or `$list` change.

### Seeding

On first run, `initStores()` (called automatically when `src/stores/index.ts` is imported) seeds `$categories` and `$catalog` from the dataset selected via the `PUBLIC_DATASET` env var (defaults to `DEFAULT_DATASET_ID` = `items_categories`) if the catalog is empty, and assigns a random `$user` if no name is set. Re-running is a no-op once populated.

#### Seed datasets

The repo-root `seed/` directory is a tracked, extensible registry of sample catalogs (`seed/index.ts`):

- `DATASETS: DatasetMeta[]` — each entry is `{ id, name, file }` (stable key, human label, seed-relative filename).
- `DEFAULT_DATASET_ID` — the fallback dataset `initStores()` seeds from when `PUBLIC_DATASET` is unset/invalid.
- `resolveDatasetId(raw)` — validates a raw dataset id (typically from `PUBLIC_DATASET`) against `DATASETS`, returning it or falling back to `DEFAULT_DATASET_ID` with a warning.
- `getDataset(id)` — returns `{ rawItems, categories, catalog }` for any registered dataset.

**Add a dataset:** drop its JSON into `seed/` and append a `DatasetMeta` to `DATASETS`. The loader normalizes it automatically (deterministic ids via the same FNV-1a scheme used by the history fixture).

**Items without a category:** any row whose `category_name` is empty/whitespace is assigned to the `uncategorized` sentinel (`id: "uncategorized"`) and **no empty-named category is created** — consistent with how `removeCategory` already reassigns orphans to `uncategorized`. Curated `frequency` values live in `FREQUENCY_BY_CATEGORY` (English set only); other datasets fall back to `"unknown"`.

#### Selecting the seeded dataset

The catalog is seeded from the dataset named by the `PUBLIC_DATASET` env var — a **public** variable (Rsbuild exposes any `PUBLIC_`-prefixed var to client code via `import.meta.env`) defined in a `.env` file at the project root. Copy `.env.example` to `.env` and set:

```sh
PUBLIC_DATASET=rick_morty
```

Valid values are the `id`s registered in `DATASETS`: `items_categories`, `leo_romanian`, `rick_morty`. An empty or unknown value falls back to `DEFAULT_DATASET_ID` and prints a warning. Because Rsbuild inlines env vars at build time, **restart the dev server (or rebuild) after changing the dataset.**

#### Seeding history (first run)

In addition to the catalog, `initStores()` seeds a simulated **6-month shopping history** into `$history` on first run (when history is empty), so the recommender has data to surface for new users. Always on; disable by setting `PUBLIC_SEED_HISTORY=0` in `.env`.

The generator lives in `seed/history.ts` (`generateShoppingHistory`) and is **frequency-aware** and **reproducible** (seeded `mulberry32` PRNG, default seed `42`):

- **Adds** follow each item's category `frequency` via the same `FREQ_TO_DAYS` map the recommender uses (`recommender.ts`), so a weekly item is repurchased roughly every 7 days, monthly every ~30, etc. Jitter (±20%) plus a per-item phase offset keeps the last-purchase dates spread, yielding a realistic mix of *overdue / soon / frequent* recommendations at `now`. For the shipped datasets this naturally lands at ~1–10 additions per day.
- **Shopping sessions** happen every 2–3 days. Each session removes most of the items currently on the list (bought), clustered within a 1–3-hour window; **0–3 items are intentionally left over** (still on the list with no trailing `remove` event — the realistic "didn't get to it" outcome).
- History is written in a **single `$history.set(...)`** (not one `logHistory` call per event) so first-run seeding stays cheap.
- Output is deterministic for a given `{catalog, categories, days, seed}`, so recommendations are reproducible across runs.

#### Reset & reseed (runtime)

Beyond the build-time `PUBLIC_DATASET` first run, the app offers a user-initiated **reset & reseed** from **Settings** (`/` → Settings). It wipes all user data — `$list`, `$history`, `$catalog`, `$categories`, and the `$user` profile — then repopulates `$catalog`/`$categories` from a dataset the user picks at reset time (one of the three registered in `seed/index.ts`), regenerating a fresh random `$user` and first-run history. The theme preference (`remindit:theme`) is deliberately preserved. This is powered by `seedFromDataset(datasetId)` in `src/stores/index.ts`, which always overwrites (unlike `initStores`, which only acts when stores are empty).

### Dev tooling

In dev builds (`import.meta.env.DEV`), every store is attached to `@nanostores/logger` for console inspection.

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

## Testing

- **Component unit tests are intentionally postponed** until they are actually required. While the UI is actively evolving (e.g. refactoring panels), maintaining per-component unit tests is churn with little payoff — delete or skip them rather than keeping them in sync with each change.
- **Before any version bump / release**, make sure both are in place and green:
  - component tests for the critical UI (`src/components/**/*.test.tsx`), and
  - end-to-end tests (Playwright, `e2e/`).
- The store layer in `src/stores/**` should keep its unit tests — that layer is stable and cheap to test.
```
