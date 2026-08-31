# Code review execution plan — main functionalities (demo scenarios)

> Source: full code review performed 2026-08-31 against the flows exercised by
> `scripts/demo-scenarios.ts` (onboarding, install banner, catalog add, quick add,
> theme, catalog CRUD, install instructions). Scope: correctness bugs, architecture
> drift, `docs/DEV.md` sync, test-coverage gaps. Status markers updated as items land.

## Summary of findings

- All demo flows **functionally check out** (roles, labels, testids, delays verified).
- 1 high-severity bug (history day-group sort), 6 medium correctness risks, 4
  Shark-UI rule violations, 24 stale spots in `docs/DEV.md`, and e2e coverage of
  **zero** user-facing flows (Playwright covers infra only).
- Test configs (`rstest*.config.ts`, `package.json` scripts) are in sync with docs;
  test *content* has gaps in onboarding, quick-add, PWA install wiring, catalog CRUD UI.

## W1 — Fix history day-group sorting (HIGH) — DONE

`src/lib/history-view.ts` — `groupByDay` sorts unpadded `YYYY-M-D` keys
lexicographically (`"2026-10-2" < "2026-10-15"`, `"2026-9-30" > "2026-10-1"`).

- Zero-pad month/day in `dayKey` (or sort by timestamp).
- Extend `src/lib/history-view.test.ts`: multi-month span, October crossing, mixed
  1-vs-2-digit days.
- AC: `bun run test:quick` green; ordering correct across month boundaries.

## W2 — Recommender numeric guards (MEDIUM) — DONE

`src/stores/recommender.ts` — no guard for `medianInterval === 0` (same-ms
add/remove/re-add): `dueRatio` becomes `Infinity`/`NaN`; `NaN` breaks the sort
comparator.

- Fall back to category-frequency interval → 14-day when median is `0`/non-finite.
- Make `scoreItem`/`computeRecommendations` robust to non-finite ratios.
- Add cases to `tests/stores/recommender.test.ts`.

## W3 — Quick-add Enter double-create guard (MEDIUM) — DONE

`src/components/quick-add-dialog.tsx` — `handleKeyDown` is attached to both the
`Autocomplete` root and the `AutocompleteInput`; Enter with a highlighted option
can fire select (`handleValueChange`) **and** `createNewItem()` → duplicate catalog
item + duplicate list entry.

- Ensure Enter either selects the highlighted option or creates new — never both.
- Add `src/components/quick-add-dialog.test.tsx`: select-existing, category-pill
  create (`Add “x” to Fridge`), 3-char guard, Enter-with-highlighted-option (no dup),
  Enter-on-novel-value creates exactly one item.

## W4 — Eliminate "empty store = first run" resurrection (MEDIUM) — DONE

`src/stores/index.ts` (`initStores`) re-seeds the full dataset when the user has
deleted every catalog item (emptiness used as first-run marker), and can seed a
catalog with dangling `categoryId`s when `$categories` is non-empty.

- Gate auto-seeding on the persisted `remindit:onboarded` flag (never re-seed once
  onboarded, even if stores are empty); keep `completeOnboarding` / `seedFromDataset`
  behavior unchanged.
- Update `tests/stores/init.test.ts`: add "onboarded + empty stores → no re-seed".

## W5 — Robustness & a11y polish (LOW) — DONE

- `src/stores/pwa-install.ts` — `installApp()` can throw `'Not allowed to prompt.'`
  (race between `canInstall()` and the call); catch inside and return a failure
  outcome. Callers (`src/components/menu.tsx`, `src/components/install-banner.tsx`)
  stay unhandled-safe. Update `tests/stores/pwa-install.test.ts`.
- `src/stores/selectors.ts` — bound the unbounded `$itemDetailCache` (evict after a
  cap; drop entries for deleted items).
- `src/components/install-banner.tsx` — announce via `role="status"` +
  `aria-live="polite"`.
- `src/components/catalog/swipeable-item-row.tsx` — expose revealed-delete state to
  AT (minimal `aria` addition; no render-phase refactor).

## W6 — Architecture drift (MEDIUM) — DONE

- **`src/stores/list.ts` imports sibling write action `logHistory`** — the only
  action-level edge that contradicts the "cross-store flows live in `commands.ts`"
  rule. Decision: **document the sanctioned exception** (history logging is
  intrinsic to list mutation; moving it would force every caller through commands).
  Comment in `list.ts` + rule text in `docs/DEV.md`.
- **`src/lib/local-data.ts` resets 12 store atoms** — layering inversion; move the
  wipe logic into a `commands.ts` action and call it from there.
- **4 direct `@ark-ui/react` imports in feature code** (rule: consume Shark
  wrappers only): `src/components/quick-add-dialog.tsx`, `src/components/catalog/item-dialog.tsx`,
  `src/components/catalog/category-dialog.tsx`, `src/components/palette-chooser.tsx`.
  Re-export `useFilter` / `useListCollection` / `createListCollection` from the Shark
  wrappers (`src/components/ui/combobox.tsx`, `src/components/ui/select.tsx`) and
  import from those in feature files.

## W7 — docs/DEV.md sync (24 discrepancies) + demo-script comments — DONE

- Fix stale claims: `initStores` side-effect/exports (no user seed, logger is
  separate), dataset id list missing `minimal`, `PUBLIC_DATASET` is fallback only,
  reset & reseed profile wording, quick-add category-pill create (not
  `UNCATEGORIZED_ID`-fixed; ≥3-char guard), ItemCatalog `useCatalog`/`removeFromListByItemId`
  + View Transitions, menu/layout diagram (`+` lives in the panel float;
  `InstallBanner`/`UpdatePrompt`/onboarding gate; `min-h-14 md:min-h-16`), seeded
  category frequencies (English dataset curated), recommender exclusions
  (zero-history items) + `soon` boundary (`> 0.7`), `/changelog` route, DiceBear
  `personas` style, `useDrawerContext` location, store-modules table (+`onboarding.ts`,
  `persistence.ts`, `pwa-install.ts`, `theme.ts`, sort feature, missing selectors),
  history event `categoryName`, logger covers 5 stores only, `localAvatar`.
- Add missing sections: PWA install/update system, local-data download/erase, theme
  store, onboarding store, persistence layer, sort feature, item-travel View
  Transitions, catalog management UI (dialogs, swipeable rows).
- `.env.example`: add `minimal` to the dataset id list.
- `scripts/demo-scenarios.ts` comment fixes: the catalog dialog labels **do** have
  `htmlFor` (Ark Field auto-associates) — correct the stale note; correct the
  "Enter-key path" wording (create-row is an ordinary option; Enter path uses the
  category pill); note the accordion-default fragility scenario 03 depends on.

## W8 — E2E replay of demo scenarios + onboarding tests — DONE

- New `e2e/demo-flows.spec.ts`: assert (not record) the seven demo flows —
  onboarding finish→seed, mock `beforeinstallprompt` → banner → "Maybe later",
  catalog chip toggle, quick-add select/create, theme flip via menu, catalog CRUD
  (add/rename/swipe-delete/confirm), install-instructions dialog after
  `appinstalled`. Reuse the selectors already proven by the recorder script.
- New onboarding coverage: `completeOnboarding()` store test (seed + profile persist
  + flag flip) and an Onboarding view test (dice roll, dataset radio, Finish).
- AC: `bun run test:e2e` green; new Rstest tests green.

## Execution order

| Batch | Items | Parallel? |
|---|---|---|
| 1 | W1, W2, W3, W4, W5 | yes (disjoint files) |
| 2 | W6, W7, W8 | yes (disjoint: code / docs / e2e) |
| 3 | Repo-wide verify: `bun run check`, `bun run lint`, `bun run test`, `bun run build`, `bun run test:e2e` | — |

## Verification matrix

| Gate | Command |
|---|---|
| Format/imports/lint | `bun run check && bun run lint` |
| Unit/component | `bun run test` |
| Typecheck/build | `bun run build` |
| E2E (dev server) | `bun run test:e2e` |
