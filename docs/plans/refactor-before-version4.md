# Refactor-before-Version-4 — Encapsulation & Testability

Pre-Phase-4 hardening pass. Phase 4 (multi-user, sync) will touch store
boundaries heavily, so the store call graph and barrel exports must be cleaned
up first: today several seams only work "by accident" (ESM live-binding cycles),
and meaningful logic is trapped inside components where it can't be unit-tested.

Outcome of the code review carried out on 2026-08-30 (see
`docs/plans/refactor-before-version4.md`). Nothing here changes user-facing
behavior.

> Amended vs. review: dead exports are kept for now — `setEntryChecked` /
> `clearList` / `clearHistory` map to the promised (but not yet built) "check
> items off" feature. They get a decision call, not a blind trim. See
> **Step 6**.

## Decisions
- **Hooks leave `@/stores`.** The barrel must not re-export React hooks
  (`useCatalog`, `useDrawer`, `useShoppingList`, `usePwaInstall`). Using the
  barrel from a hook and the hook from the barrel is a barrel↔hook cycle that
  only works via ESM live bindings.
- **Cross-store operations move to `stores/commands.ts`.** Store modules stop
  importing each other's action functions; composite flows (delete-category,
  delete-item-with-cascade, add-to-list-with-history) live in one orchestrator
  that imports the atoms.
- **Pure view logic is extracted to `src/lib/`** so it can be unit-tested
  without DOM (happy-dom) and shared (single source of truth for duplicates).
- **No import-time persistence writes.** The "barrel has no side effects"
  contract becomes true for every store module.
- **History rows render the stored `categoryName` snapshot**, not the live
  category name. `help.tsx` already promises this; today it's a bug.
- **`tsconfig` stays `strict: false` for this pass** (see Step 7 — optional,
  gated on a separate decision).

## Architecture changes

### 1. Hooks out of the stores barrel — `src/stores/index.ts`, `src/hooks/*`
- Remove `export { useCatalog } / useDrawer / useShoppingList` from
  `stores/index.ts`.
- Components switch imports to `@/hooks/...` (or the component module for
  `useDrawer` / `usePwaInstall`):
  - `item-catalog.tsx` → `useCatalog` from `@/hooks/use-catalog`
  - `shopping-list-panel.tsx` → `useShoppingList` from `@/hooks/use-shopping-list`
  - `item-detail-drawer.tsx` → `useDrawer` from `@/components/drawer-context`
  - `install-banner.tsx` / `menu.tsx` → `usePwaInstall` from
    `@/stores/pwa-install` stays, but rename file to a hook-friendly home, or
    move `usePwaInstall` to `@/hooks/use-pwa-install` (imports store atoms).
- Prefer moving `usePwaInstall` to `@/hooks/use-pwa-install.ts` for consistency.

### 2. Commands layer — `src/stores/commands.ts` (new)
Orients previously circular imports into a single module that imports the atoms:

Current graph (all static imports, cycle only masked by live bindings):
`catalog ↔ list → history → categories → catalog`

- `catalog.ts` imports `removeListEntriesForItem` from `list`
  (used in `removeCatalogItem`).
- `list.ts` imports `addCatalogItem`, `getCatalogItem` from `catalog`
  (used in `addToList`, `createItemAndAddToList`).
- `categories.ts` imports `reassignItemsToCategory` from `catalog`
  (used in `removeCategory`).
- `history.ts` imports `$categories` (used in `logHistory`).

After:
- Store modules hold **single-resource actions only** and never import sibling
  store action functions.
- `commands.ts` imports `$catalog`, `$list`, `$categories`, `$history` and
  exports the composite flows:
  - `deleteCategoryWithReassign(id)` → `reassignItemsToCategory` +
    `$categories` filter (move logic from `categories.ts`).
  - `deleteCatalogItemWithCascade(id)` → `$catalog` filter +
    `removeListEntriesForItem` (move from `catalog.ts`).
  - `createItemAndAddToList(name, categoryId)` (move from `list.ts`).
- Update the stale "lazy cross-import contract" comments in `catalog.ts` and
  `list.ts` — after this change the controller docs live in `commands.ts`.
- Keep `history.ts` importing `$categories` (single outgoing edge, no cycle).
- Export commands from the barrel for the UI call sites
  (`category-section.tsx`, `category-items-table.tsx`, `quick-add-dialog.tsx`).

Verify no cycles: `src` should compile and `bun run test` pass; optionally run a
once-off import-graph check (e.g. `madge --circular src seed` if available, else
manual).

### 3. Palette side effect — `src/stores/palette.ts`
- Remove the module-scope guard (current lines 24-26) that persists on import.
- The fallback already lives in `getActivePaletteId()`; add a one-time
  `initActivePalette()` if a persisted-id reset is still wanted, called from
  `initStores()`.

### 4. Seeding consolidation — `src/stores/index.ts`
- Extract shared `seedCategories(categories)` (prepend
  `uncategorized` sentinel + `assignCategoryColors`) used by both
  `initStores()` and `seedFromDataset()`.
- Both paths already call the normalizers; keep that, but move the
  "build catalog + categories for dataset" into one helper so the two paths
  can't drift.

### 5. Pure logic extraction — `src/lib/`
- `lib/quick-add.ts` (new): `buildItems(useRecommendedOnly, recs, groups, rank)`
  + `isNewValue`, `NEW_CATEGORY_ID`, `RECS_ONLY_THRESHOLD` from
  `quick-add-dialog.tsx`; component becomes a thin consumer.
- `lib/history-view.ts` (new): `dayKey`, `formatDayHeading(ts, now)` and
  `groupByDay(events)` from `views/history.tsx`.
- `lib/display.ts` (new): `avatarInitials({firstName,lastName,username})` —
  de-duplicate `menu.tsx` and the initials logic in
  `user.ts` `localAvatar` (single source, shared by both).
- `lib/pwa-install.ts` (new): export `detectPlatform()` and `isStandalone()`
  along with `ManualInstallPlatform`; `pwa-install.ts` keeps only atom wiring.
- `lib/theme-options.ts` (new, optional): `OPTIONS` + `ORDER` from
  `theme-toggle.tsx` so `theme-menu.tsx` stops importing from another component.

### 6. Behavior fixes (low risk, do with the cutover)
- **History snapshot** (`views/history.tsx`): drop `eventsByName` remap; render
  `event.categoryName` as stored (fallback to `UNCATEGORIZED_NAME` when empty).
  Fixes empty badge for deleted categories + incorrect name for renamed ones.
- **Category palette hook** (`hooks/use-category-palette.ts`): add a cached
  `$categoryById` Map selector in `selectors.ts`; subscribe to `$categories` so
  a slot change recolors mounted chips; use the Map for O(1) lookups.
- `category-palette.ts`: reconcile `button` vs `buttonSelected` (doc says ring;
  currently identical strings) — decide intent, align token + interface doc.
- Confirm/trim dead exports: `clearHistory`/`clearList`/`setEntryChecked`,
  `$checkedCount`/`$listCount`/`$activeCategoryIds`, `getActivePalette`
  (currently referenced only by tests). If the checkbox feature is real, wire
  `setEntryChecked` into the shopping-list panel — otherwise remove + prune
  barrel `export *`.

## Suggested order
1. Hooks out of `@/stores` (mechanical, removes barrel↔hook cycle).
2. `commands.ts` + break store import cycles (highest encapsulation leverage).
3. Extract `lib/*` pure helpers + their unit tests.
4. Palette import-time side effect.
5. Seeding consolidation.
6. History snapshot fix + palette-hook Lookup + dead-export decision.
7. (Optional, needs explicit sign-off) `tsconfig` `strict: true` + `noUncheckedIndexedAccess`; run Biome + typecheck and fix the resulting null-handling.

## Testing
- Unit-test the extracted pure helpers (no DOM needed):
  `lib/quick-add.test.ts`, `lib/history-view.test.ts`, `lib/display.test.ts`,
  `lib/pwa-install.test.ts` (detectPlatform UA cases) — mirror the existing
  `src/lib/*.test.ts` style used for `category-palette`/`palettes`.
- Store tests keep `tests/fixtures/reset.ts`; commands get their own
  `tests/stores/commands.test.ts` (delete-category reassigns, delete-item
  cascades list entries, no history writes).
- Run `bun run lint`, `bun run test`, then `bun run build` to confirm no import
  cycles at bundle time and that code-splitting is unchanged.

## Files
| Action | File |
|---|---|
| new | `src/stores/commands.ts` |
| new | `src/lib/quick-add.ts` |
| new | `src/lib/history-view.ts` |
| new | `src/lib/display.ts` |
| new | `src/lib/pwa-install.ts` |
| new | `src/lib/theme-options.ts` (optional) |
| new | `src/hooks/use-pwa-install.ts` (if moving the hook) |
| mod | `src/stores/index.ts` (drop hook re-exports, seeding helper, add command exports) |
| mod | `src/stores/catalog.ts` / `list.ts` / `categories.ts` (remove cross-imports; move composite flows to commands) |
| mod | `src/stores/palette.ts` (no import-time write) |
| mod | `src/hooks/use-category-palette.ts` |
| mod | `src/stores/selectors.ts` (`$categoryById`) |
| mod | `src/views/history.tsx`, `src/components/quick-add-dialog.tsx`, `src/components/menu.tsx`, `src/components/theme-menu.tsx`, `src/components/theme-toggle.tsx` |
| mod | `src/components/item-catalog.tsx`, `src/components/shopping-list-panel.tsx`, `src/components/item-detail-drawer.tsx`, `src/views/profile.tsx` |
| mod | `src/components/catalog/category-section.tsx`, `category-items-table.tsx` (use commands) |
| mod | `docs/DEV.md` (note the commands layer + hooks-home convention) |
| new | `tests/stores/commands.test.ts`, `tests/lib/*.test.ts` |

Local feature branch per the repo convention (more than 10 files);
`feat:`/`refactor:` semantic commits; no PR/push unless asked.

## Follow-ups (out of scope)
- The "check items off" UI using `setEntryChecked` (decides whether the dead
  helpers survive).
- `tsconfig` strict pass, split into its own plan once this refactor lands.