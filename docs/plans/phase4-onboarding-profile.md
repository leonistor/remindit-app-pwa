# Phase 4 — Onboarding & Profile (slice 1)

Phase 4 is multi-user + server sync with real-time collaboration. This slice
delivers the first building blocks: a proper single-user **profile data model**,
a first-run **onboarding** flow, and a renamed/moved **Profile** page.

> Amended vs. original plan: **`migrateUser` is dropped.** Current users clear
> the browser cache and start fresh, so no legacy `{ name, photo }` migration is
> needed. `initStores` simply treats "no profile yet" as "not onboarded".

## Decisions
- **Names**: `generate-random-username` returns only a handle (`humble-shrew`).
  Derive `firstName`/`lastName` by splitting on `-` (capitalized) → `Humble Shrew`,
  username `humble-shrew`. Single tiny dependency.
- **Route**: `/settings` → `/profile` (URL changes; links + e2e updated).
- **Menu**: `Profile` is the **first dropdown item**, before `Catalog`. The
  inline "Shopping list" link stays.

## Bundle constraint (verified)
- `generate-random-username` + `@dicebear/core` + `@dicebear/styles` (cameo) are
  **dynamically imported only inside onboarding and Profile** via
  `src/lib/profile-generator.ts`. The store/seed layer never statically imports
  them and keeps the existing `localAvatar` initials fallback for any sync path.
- DiceBear v10 API: `new Style(definition)` / `new Avatar(style, { seed }).toDataUri()`.
  Avatar stored as a **data URI** for inline `<img>` use and easy persistence.
- Rspack auto-splits dynamic imports into their own chunk. Verify via `bun run build`.

## Architecture

### 1. User data model — `src/stores/types.ts`
Replace `User { name, photo }` with:
```ts
interface UserProfile {
  username: string   // mandatory, default random
  firstName: string
  lastName: string
  email: string
  avatar: string     // data URI (dicebear or initials fallback)
}
```

### 2. User store — `src/stores/user.ts`
- New shape; `updateUser(patch)` merges.
- Keep `localAvatar(name)` + `randomUser()` as a **sync fallback** that returns a
  `UserProfile` with an initials `avatar` (used only when no generated profile is
  passed to reseed).

### 3. Onboarding state — `src/stores/onboarding.ts` (new)
- `$onboarded` persistent bool (`remindit:onboarded`), `isOnboarded()`, `setOnboarded()`.
- `$selectedDatasetId` persistent (`remindit:selected-dataset`), `getSelectedDataset()`,
  `setSelectedDataset()`.
- `completeOnboarding(profile, datasetId)`: persist profile, set selected dataset,
  `seedFromDataset(datasetId, profile)`, `setOnboarded(true)`.

### 4. Seeding refactor — `src/stores/index.ts`
- `initStores()`: if **not onboarded**, skip catalog/categories/history seeding and
  skip auto `randomUser()`. If onboarded, seed from `getSelectedDataset()` (falls back
  to `resolveDatasetId(PUBLIC_DATASET)`). Theme always inits.
- `seedFromDataset(datasetId, profile?)`: set `profile` as the user when given
  (onboarding / reset); else sync `randomUser()` fallback.

### 5. "minimal" dataset — `seed/`
- Add `seed/minimal.json` (simplified subset of `items_categories`).
- Register in `seed/index.ts`; set `DEFAULT_DATASET_ID = "minimal"`. Onboarding
  preselects the default.

### 6. Generator — `src/lib/profile-generator.ts` (new, bundle-split)
```ts
export async function generateRandomProfile(): Promise<UserProfile> {
  const [{ default: gen }, { Style, Avatar }, cameoMod] = await Promise.all([
    import("generate-random-username"),
    import("@dicebear/core"),
    import("@dicebear/styles/cameo.json"),
  ])
  const username = gen({ separator: "-" })
  const [f, l] = username.split("-")
  const avatar = new Avatar(new Style(cameoMod.default), { seed: username }).toDataUri()
  return { username, firstName: cap(f), lastName: cap(l), email: "", avatar }
}
```
Imported by onboarding **and** Profile only.

## UI

### Onboarding view — `src/views/onboarding.tsx` (new)
Full-screen, own route (no menu). Two steps:
- **Step 1 (profile)**: editable First/Last/Username `Input`s (`Field`+`Input`),
  avatar `<img>` preview, **🎲 Dice** button → `generateRandomProfile()` regenerates
  all three + avatar; "Accept & continue".
- **Step 2 (dataset)**: `SegmentGroup` of `DATASETS` (default = minimal);
  "Finish" → `completeOnboarding` → navigate `/`.

### Profile view — `src/views/profile.tsx` (from `settings.tsx`)
- Profile form (update firstName, lastName, username; avatar shown read-only —
  "avatar update later").
- Link/card → Catalog (`/catalog`).
- `PaletteChooser` (moved from Settings).
- Reset & reseed (moved; uses `generateRandomProfile()` async so the reseeded
  profile gets a dicebear avatar, then `seedFromDataset`).

### Menu — `src/components/menu.tsx`
Swap `Settings` → `Profile` (Phosphor `User`/`IdentificationCard` icon), first in
dropdown, route `/profile`.

### Router — `src/router.tsx`
Add top-level `/onboarding` (no Layout menu). Guard in `Layout` redirects to
`/onboarding` when `!isOnboarded()`.

## Component APIs — verify against `src/components/ui/*` source
(skills may be stale). Needed: Card, Button (custom), Input, Field, SegmentGroup,
Dialog, Listbox (PaletteChooser), Badge; Phosphor `DiceFive`, `User`, `Rows`.

## Files
| Action | File |
|---|---|
| new | `docs/plans/phase4-onboarding-profile.md` |
| new | `src/lib/profile-generator.ts` |
| new | `src/stores/onboarding.ts` |
| new | `src/views/onboarding.tsx` |
| new | `src/views/profile.tsx` |
| new | `seed/minimal.json` |
| mod | `src/stores/types.ts`, `user.ts`, `index.ts` |
| mod | `seed/index.ts` (minimal + default) |
| mod | `src/views/settings.tsx` (delete → profile) |
| mod | `src/components/menu.tsx`, `src/router.tsx` |
| mod | `docs/DEV.md` |
| mod | `tests/fixtures/reset.ts`, `tests/stores/user.test.ts`, `tests/stores/reseed.test.ts`, `e2e/menu.spec.ts` |

## Build / verify
- `bun add @dicebear/core @dicebear/styles generate-random-username`
- Verify bundle split: `bun run build` → dicebear + generate-random-username in a
  separate async chunk, not `main`.
- `bun run lint` + `bun run test`, then `bun run build`.
- Local feature branch `feature/phase4-onboarding-profile`; commit there; no PR/push.

## Follow-ups (out of scope)
- Avatar update in Profile (re-roll).
- Future onboarding steps (feature overview).
- Multi-user/sync (rest of Phase 4).
