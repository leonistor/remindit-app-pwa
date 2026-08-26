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

| Panel | Title | Content |
|---|---|---|
| Left (30%) | Selected items | Items on the active shopping list |
| Right (70%) | All items | Catalog items grouped by category |

Catalog items show recommendation badges (overdue/soon dots) based on the computed `$recommendations` store.

### Item detail drawer

A context-managed drawer (`DrawerProvider` + `ItemDetailDrawer`) sits at the Layout level. Any component can open it via `useDrawerContext().openDrawer(itemId)`. Phase 3 will populate the drawer content with item attributes (photo, quantity, price).

### Routes

| Path | View | Description |
|---|---|---|
| `/` | ShoppingPanels | Main shopping list + catalog |
| `/catalog` | CatalogView | Manage catalog items |
| `/history` | HistoryView | View shopping history |
| `/settings` | SettingsView | User preferences |
| `/about` | AboutView | About the app |
| `/help` | HelpView | Usage help |

## UI components (Shark UI)

Our primary UI framework is **Shark UI** — a shadcn-style component registry built on top of [Ark UI](https://ark-ui.com). Components live in `src/components/ui/*` and are added from the registry with the shadcn CLI:

```bash
bunx shadcn add @shark/<component>
```

Registry config lives in `components.json` (style `base-nova`, Phosphor icons, `@shark` registry at `https://shark.vini.one/r/{name}.json`).

**Rules:**

- Build feature UI from the existing `src/components/ui/*` Shark primitives — do **not** reach for raw `@ark-ui/react` in feature components. If a primitive is missing, add it via the CLI (or wrap Ark UI in `src/components/ui` following the existing pattern) instead of importing Ark directly.
- Use `cn()` from `@/lib/utils` and Shark's built-in `variant` / `size` props and semantic tokens (`bg-primary`, `text-muted-foreground`, `border-input`). Avoid ad-hoc `dark:` palette pairs and `space-x/y-*`.
- The registry docs/examples are the source of truth for each component's API and composition — check them before assuming an Ark/Radix/shadcn API.

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
- **User** (`$user`) — `{ name, photo }`, assigned random defaults on first run.

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
| `index.ts`      | Barrel exports + `initStores()` (seeds sample data, random user, dev logger)                                                                            |

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
