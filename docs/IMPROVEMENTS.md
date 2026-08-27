# Codebase Improvement Plan

Analysis-driven plan to improve separation of concerns, encapsulation, clean code,
and extensibility for `remindit-app-pwa`. Produced from a three-angle review of the
stores, components/views, and build/config layers.

## How to execute

- Each **tier** is implemented on its **own feature branch**.
- After implementation, run the **Playwright e2e** suite (and the Rstest unit suite)
  to verify no regressions.
- Only **merge into `main`** if all tests pass and the build is green.
- `tsconfig` stays at `strict: false` (intentional — out of scope).

Branch naming suggestion: `feat/impr-tier-1`, `feat/impr-tier-2`, `feat/impr-tier-3`.

---

## Tier 0 — Dead code removal (do first)

**Goal: reduce noise before structural changes.**

- **13. Remove `src/examples/*`** — `AllItemsExample.tsx`, `GroupingList.tsx`,
  `Resizable.tsx`, `TransferList.tsx` are unreferenced demo files. Delete the directory
  (or gate behind a dev-only route if they are useful as a playground). Verify with a
  grep that nothing imports them, then remove.

---

## Tier 1 — Encapsulation & persistence (highest value, low risk)

**Status: DONE** — merged to `main` (commit `308394b`). Verified: biome lint,
rstest (105 passed), Playwright (6 passed), `rsbuild build`.

- Items 1–4 implemented as written.
- Item 5: the `catalog ⇄ list` cycle was **documented** (lazy cross-import
  contract in `catalog.ts` / `list.ts`) rather than restructured. A blanket
  `list`-side subscription would have changed cascade semantics (dropping *all*
  list entries whose items aren't in the catalog) and broken
  `tests/stores/catalog.test.ts`. The `categories → catalog` leakage (item 1)
  was genuinely removed via `reassignItemsToCategory`.

1. **Add a catalog action for category reassignment**
   Replace `$catalog.set(reassigned)` in `src/stores/categories.ts:87` with a new
   `reassignItemsToCategory(fromId, toId)` action in `src/stores/catalog.ts`. Keeps
   catalog's write invariant self-contained; `categories.ts` never touches the catalog atom.

2. **Add `removeFromListByItemId(itemId)`** in `src/stores/list.ts` (mirror of `addToList`),
   and call it from `src/components/item-catalog.tsx:99` instead of imperatively resolving
   `entryId` via `$selectedView.get()`. Removes a logic leak + a stale-read risk.

3. **Introduce a persistence boundary** — new `src/stores/persistence.ts` exporting:
   - a `STORAGE_KEYS` constant (centralizes the scattered `"remindit:"` literals),
   - a unified `jsonAtom` / `jsonStore` helper used by every persistent store.
   Reference from `catalog.ts`, `list.ts`, `history.ts`, `categories.ts`, `user.ts`,
   `ui.ts`, `theme.ts`. Fixes the inconsistent serialization (raw string in
   `theme.ts:7` vs JSON elsewhere).

4. **Remove import-time side effects** — delete the `initStores()` auto-run at
   `src/stores/index.ts:120`; call it explicitly from `src/index.tsx` next to
   `initTheme()`. Guard `@nanostores/logger` behind an explicit `setupDevLogging()` so it
   is not wired on every `@/stores` import.

5. **Break the `catalog ⇄ list` cycle** (`catalog.ts:6` ↔ `list.ts:5`) by extracting shared
   id lookups into a tiny `src/stores/ids.ts` both import, or document the lazy-use
   contract to prevent a future TDZ crash.

---

## Tier 2 — Clean code & de-duplication

6. **Extract dialog + legend single sources**
   - `<FormDialog>` + `<ValidatedField>` components (collapses `item-dialog.tsx`,
     `category-dialog.tsx`, and the `catalog.tsx:29-93` boilerplate).
   - A `RECOMMENDATION_TIERS` constant (label + color token) consumed by
     `item-catalog.tsx:57-70`, `help.tsx:30-45`, and `item-button.tsx:9-10` to prevent
     legend drift.

7. **Move sort UI state machine into `ui.ts`** — add `toggleCategoriesVisible` and
   `toggleSelectedSort` actions so `shopping-list-panel.tsx:61-82` becomes purely
   declarative (removes the `$selectedSort.get()` read inside a `useStore` subscriber).

8. **Add derived selectors** `$recommendationsByItemId` and `$itemDetail(itemId)` in
   `selectors.ts` to remove inline `.find()` joins in `item-catalog.tsx:37-40` and
   `item-detail-drawer.tsx:19-20`.

9. **Rename `themeStore` → `$theme`** in `src/stores/theme.ts:7` for `$`-prefix
   consistency; update `theme-toggle.tsx:28` and tests.

10. **Use `UNCATEGORIZED_NAME`** instead of the literal `"Uncategorized"` at
    `recommender.ts:202` (already imported correctly in `selectors.ts`).

11. **Per-feature hook layer** — `useShoppingList()`, `useCatalog()`, `useDrawer()` to
    hide atom names from components and ease testing/mocking.

---

## Tier 3 — Config & polish (low risk, cosmetic)

12. **Wire or stub the drawer** — either call `openDrawer` from item/catalog UI, or
    document `ItemDetailDrawer` as a Phase-3 stub (currently `openDrawer` in
    `drawer-context.tsx:22` is never called, so the drawer can never open).

13. **Externalize PWA manifest** from `rsbuild.config.ts:48-185` into
    `pwa-manifest.config.ts`; centralize `theme_color` + icon palette into one constant
    consumed by both `rsbuild.config.ts` and `scripts/generate-favicons.ts`, reconciled
    with the actual app primary (the hardcoded `#863bff` purple contradicts the neutral
    app chrome).

14. **Decide on `"use client"`** — strip the no-op directives (Next.js residue, inert in
    an Rsbuild SPA) or document them as intentional with a Biome ignore.

15. **Local-first avatar** — replace `i.pravatar.cc` (`user.ts:30`) with a generated local
    avatar (initials / SVG data-URI) to honor the offline/local-first positioning.

16. **Minor**: unify dataset import style (`stores/index.ts:9` relative vs `settings.tsx`
    alias); use the `@/` alias for the `CHANGELOG.md` import (`changelog.tsx:3`); trim the
    dormant ~1.5k-line theme class block in `globals.css` (Phase-3 palettes, no consumers
    yet) or generate it via a loop.

---

## Suggested execution order

Tier 0 → Tier 1 (steps 3 → 1 → 2 → 4 → 5) → Tier 2 (6 → 7 → 8 → 9 → 10 → 11) → Tier 3.

Tier 1 steps are independent and can be parallelized across sub-agents; Tier 2 builds on
Tier 1's cleaner store surface. After each tier: Playwright + Rstest, then merge to `main`
only if green.
