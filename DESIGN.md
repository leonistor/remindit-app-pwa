# RemindIt — Design System

> **Scope:** contributors only. Describes the current look as shipped — no proposals. Text-only reference; source of truth is code (`src/styles/globals.css`, `seed/palettes.json`, `components.json`). For implementation details see `docs/DEV.md`.

## 1. Principles

- **Local-first, low-friction.** The shopping interaction is the whole product: one tap to add/remove, no auth wall, data in `localStorage` (`remindit:` prefix). UI stays out of the way.
- **Neutral chrome, colorful content.** Shell is near-monochrome (`neutral-50` / `neutral-950`); category color carries identity and disambiguation.
- **Legibility over decoration.** Single highly-legible typeface, semantic tokens, generous radius and spacing, motion that explains state (enter/exit, drawer slide) and respects `prefers-reduced-motion`.
- **Shark UI as the primitive layer.** Feature code consumes `src/components/ui/*` wrappers; `@ark-ui/react` is an internal detail. Missing primitives are added via `bunx shadcn add @shark/<name>` and wrapped — never imported raw in features.

## 2. Brand

- **Name:** RemindIt (capital I, single word). Wordmark is not rendered as type in chrome — the round logo + user avatar are the header identity.
- **Logo:** `public/remindit-icon.svg` and `public/remindit-icon-maskable.svg`, fill `#262626` on white. Same value is the PWA brand color so manifest, favicons, and chrome reconcile.
- **PWA:** manifest object `WEB_APP_MANIFEST` in `pwa-manifest.config.ts:1` exports `PWA_THEME_COLOR` / `PWA_BACKGROUND_COLOR` (`#262626` / `#ffffff`). `scripts/generate-favicons.ts` imports the same constants; the HTML `theme-color` meta in `public/index.html:12` matches. Do not hard-code brand hex elsewhere.
- **Voice:** plain verbs, sentence case, no filler. Controls say what they do ("Save changes", "Reset & reseed"). Empty/error states give direction, not persona. See `frontend-design` copy guidance in repo skill — current copy follows it.

## 3. Typography

- **Typeface:** self-hosted **Atkinson Hyperlegible Next Variable** (`@fontsource-variable/atkinson-hyperlegible-next`, weights `200–800`) imported in `src/index.tsx`. Exposed as `--font-sans` in `src/styles/globals.css:9`:
  ```css
  --font-sans: "Atkinson Hyperlegible Next Variable", ui-sans-serif, system-ui, sans-serif;
  ```
  `body` applies `font-sans`; feature components inherit — no local font declarations.
- **Tokens:** `--font-heading` and `--font-mono` are declared (`globals.css:11-12`) but currently alias/unused — there is no distinct display face today. Scale is driven by Tailwind defaults + `text-2xl` for view titles (e.g. `Profile` header).
- **Conventions:** headings are `font-bold text-2xl` in Cards/views; body is base `text-foreground` with `text-sm text-muted-foreground` for secondary copy; `FieldLabel` / `CardHeader description` carry the explanatory voice.

## 4. Color

### 4.1 Semantic / chrome tokens

Registry style `base-nova` (`components.json:4`), `baseColor: neutral`, `cssVariables: true`. Inline theme in `src/styles/globals.css:6` maps Tailwind color roles to CSS vars; actual values under `:root` (light) and `.dark`:

| Role | Light (`:root`) | Dark (`.dark`) | Notes |
|---|---|---|---|
| `background` | `neutral-50` | `neutral-950` | page + code bg |
| `foreground` | `neutral-800` | `neutral-100` | primary text |
| `card` | `neutral-50` | `background` 98% white mix | `Card` |
| `popover` | `neutral-50` | `background` 96% white mix | popovers/dialogs |
| `primary` | `neutral-800` | `neutral-100` | default button, selection |
| `primary-foreground` | `neutral-50` | `neutral-800` | on primary |
| `secondary` / `muted` / `accent` | `neutral-950` 6% over `background` | `white` 8% over `background` | subtle fills |
| `muted-foreground` | `neutral-500` 80% + `neutral-950` | `neutral-500` 70% + `neutral-50` | secondary text |
| `border` | `neutral-950` 12% over `background` | `neutral-50` 12% over `background` | every `border` |
| `input` | `neutral-950` 13% | `neutral-50` 13% | inputs |
| `ring` | `neutral-400` | `neutral-500` | focus ring |
| `destructive` | `red-500` / fg `red-700` | `red-600` 90% mix / fg `red-400` | |
| `success` | `emerald-500` / fg `emerald-700` | same hue / fg `emerald-400` | |
| `info` | `blue-500` / fg `blue-700` | same / fg `blue-400` | |
| `warning` | `amber-500` / fg `amber-700` | same / fg `amber-400` | |
| `chart-1..5` | `orange-600, teal-600, cyan-900, amber-400, amber-500` | `blue-700, emerald-500, amber-500, purple-500, rose-500` | charts (distinct per theme) |
| `sidebar` | `neutral-50` 97% + `neutral-950` | `neutral-950` 97% + `neutral-50` | sidebar tokens present but not separately rendered as a sidebar today |

Mixes use `color-mix(in srgb, …)` so neutrals track the background in both themes (`globals.css:320-490`). `color-scheme: light dark` is set in both blocks.

### 4.2 Categorical palette (items & categories)

Qualitative, colorblind-minded. **Not** tied to button variants or recommendation urgency — separate concern.

- **Pool source:** `seed/palettes.json` is the single source. `src/lib/palettes.ts:1` re-exports it as `PALETTE_POOL` / `defaultPalette` / `getPalette(id)` / `getPaletteColor(id, index)`. All palettes are length 12.
- **Pool contents (whimsical names are canonical):**

| id | Name | Source | Colors (hex in order) |
|---|---|---|---|
| `paired` | **Van Gogh** | d3 schemePaired | `#a6cee3` `#1f78b4` `#b2df8a` `#33a02c` `#fb9a99` `#e31a1c` `#fdbf6f` `#ff7f00` `#cab2d6` `#6a3d9a` `#ffff99` `#b15928` |
| `category10` | **Fast and Furious** | d3 schemeCategory10 | `#1f77b4` `#ff7f0e` `#ad9622` `#2ca02c` `#9f762a` `#d62728` `#9467bd` `#8c564b` `#e377c2` `#7f7f7f` `#bcbd22` `#17becf` |
| `dark2` | **Why so serious?** | d3 schemeDark2 | `#1b9e77` `#9a864f` `#d95f02` `#a96e76` `#7570b3` `#e7298a` `#b57c63` `#949349` `#66a61e` `#e6ab02` `#a6761d` `#666666` |
| `observable10` | **New York** | d3 schemeObservable10 | `#4269d0` `#989598` `#efb118` `#ff725c` `#6cc5b0` `#3ca951` `#b0a087` `#ff8ab7` `#a463f2` `#97bbf5` `#9c6b4e` `#9498a0` |
| `set3` | **Claude Monet** | d3 schemeSet3 | `#8dd3c7` `#ffffb3` `#bebada` `#fb8072` `#80b1d3` `#fdb462` `#b3de69` `#fccde5` `#d9d9d9` `#bc80bd` `#ccebc5` `#ffed6f` |

`defaultPaletteId` is `paired` (Van Gogh).

- **Assignment:** `Category.color` (`stores/types.ts`) is a stable palette slot (index). Assigned sequentially in dataset order by `assignCategoryColors` (`src/stores/categories.ts`) at dataset init, reset, and on `addCategory`; backfilled by `normalizeCategoryColors`. Distinctness guaranteed only up to 12 (pool size); beyond that indices wrap modulo 12.
- **Rendering:** `src/lib/category-palette.ts:1` turns a category key → `ItemPalette` via CSS variables: `--cat` (solid hex) and `--cat-ink` (WCAG contrast ink `#ffffff` or `#0a0a0a` from `relativeLuminance` → higher contrast ratio). Background is the *full* hue in both themes so one ink stays accessible. `useCategoryPalette(key, overrideSlot?)` (`src/hooks/use-category-palette.ts`) subscribes to `$activePaletteId` + `$categoryById` and prefers the stored slot, falling back to hash for ad-hoc keys (e.g. palette preview chips). Consumers set `style={palette.style}` + class tokens (`button`, `buttonSelected`, `badge`, `dimmed`, `border`, `ring`, `dot`). The `ring` token (contrast ink) is now the **desktop hover emphasis ring**: chips apply it as `ring-[color:var(--cat-ink)]` + `hover:ring-2`, so the categorical fill is preserved on hover (the `bare` variant no longer forces `hover:bg-transparent`).
- **Active palette choice:** `$activePaletteId` (`src/stores/palette.ts`, `persistent jsonStore` key `remindit:active-palette`) + `setActivePalette(id)`. Changed live in **Profile → Color palette** via `PaletteChooser` (`src/components/palette-chooser.tsx`): Shark `Listbox` with 12-swatch preview + sample chip.
- **Neutral sentinel:** `uncategorized` uses `ItemPalette` `NEUTRAL` (`category-palette.ts:NEUTRAL`): no CSS vars, `bg-muted text-foreground`, `dot: bg-muted-foreground`. Reads as "no category".

### 4.3 Recommendation tiers (urgency dots)

Distinct from categorical color. `src/lib/recommendation-tiers.ts` defines dots overlaid at `-top-0.5 -right-0.5` with `ring-2 ring-background` on `ItemButton` (see `src/components/ui/custom/item-button.tsx:77`). Semantic urgency; do not reuse for category fills.

## 5. Layout & Navigation

```
DrawerProvider
├── Menu (h-16, rounded-md border bg-accent px-4, safe-area pads)
│     logo (→ /) · ProfileAvatarLink · "Shopping list" link · hamburger MenuRoot · [+] quick-add
│     └─ MenuContent w-52: nav links + Install + ThemeMenu submenu
├── <Outlet />  (page content)
├── ItemDetailDrawer (context-managed drawer, placeholder — Phase 3)
└── Footer  (hidden on "/")
```

- **Header:** `src/components/menu.tsx:80` — `flex min-h-16 shrink-0 … rounded-md border bg-accent`. Single hamburger for all viewports (KISS). `ThemeMenu` is a `MenuSub` radio-group; `InstallInstructionsDialog` / `QuickAddDialog` live here.
- **Main shopping view `/`:** `ShoppingPanels` (`src/components/shopping-panels.tsx:1`) — vertical `Resizable` `defaultSize [30,70]`, `panels: [{id:"selected" min 25 max 90},{id:"all"}]` + `ResizableResizeTrigger withHandle`. Left = `ShoppingListPanel` (selected items), right = `ItemCatalog` (Ark `Accordion`, `multiple`, first open by default, chips grouped by category via `$catalogByCategory`, toggle via `addToList/removeFromList`).
- **Other routes:** `/catalog` CatalogView, `/history` HistoryView, `/profile` ProfileView, `/about`, `/help`, `/onboarding` (chrome-less, centered Card). Router in `src/router.tsx`.
- **Container:** `@utility container` (`globals.css:519`) = `mx-auto max-w-3xl px-2 py-2 md:px-4 md:py-4`. Cards on Profile/Onboarding are `w-full max-w-xl` centered with `flex flex-col items-center gap-6 py-8`.
- **Quick-add:** header `+` opens `QuickAddDialog` (Shark `Dialog` + grouped `Autocomplete` `@shark/autocomplete`). Source mirrors `$catalogByCategory` ordered by `frequencyRank`; when `$recommendations.length >= 10` shows only recommended items. Create-new row under `UNCATEGORIZED_ID` via `createItemAndAddToList`.

## 6. Components

### 6.1 Primitive layer

Shark UI is the only allowed UI import in feature code. Registry config `components.json:4-15`: `style base-nova`, `tailwind css src/styles/globals.css`, `baseColor neutral`, `cssVariables true`, `iconLibrary phosphor`, `registries @shark https://shark.vini.one/r/{name}.json`.

Installed primitives in `src/components/ui/`:
`accordion, alert-dialog, autocomplete, avatar, badge, button, card, collapsible, combobox, dialog, drawer, editable, field, float, input-group, input, item, listbox, menu, popover, resizable, scroll-area, segment-group, select, separator, spinner, status, table, textarea, toggle-group, toggle` — plus `custom/`.

Rules: use `cn()` (`src/lib/utils.ts:1`) + Shark `variant/size` props + semantic tokens (`bg-primary`, `text-muted-foreground`). Avoid ad-hoc `dark:` pairs and `space-x/y`.

### 6.2 Registry vs custom split (`docs/DEV.md` §Registry vs custom)

- **Registry-managed** (`src/components/ui/*`): regenerate via `bunx shadcn add @shark/<name>`; never hand-edit shape.
- **Hand-maintained** (`src/components/ui/custom/*`): `button.tsx` (forked Shark button — adds `success/info/bare`; `bare` is the transparent base for palette-colored chips), `item-button.tsx`, `toggle-tooltip.tsx`, `form-dialog.tsx`, `validated-field.tsx`. **Do not run `shadcn add @shark/button`** — upstream drops the custom variants.

### 6.3 Item display (pick the right one)

| Component | File | When to use | Color | Notes |
|---|---|---|---|---|
| `ItemButton` | `src/components/ui/custom/item-button.tsx:43` | available catalog items | `variant="bare"` + categorical palette (full hue `button` / emphasized `buttonSelected` / muted `dimmed`) via `useCategoryPalette(categoryKey)` | Props `purpose: selectable|removable|recommendation`, `isSelected`, `recommendationTier` (dot), `animationState`, `travelTargetId`. Desktop hover = `palette.ring` (`hover:ring-2`, contrast ink) — no standing emphasis ring at rest. |
| `ShoppingItem` | `src/components/shopping-item.tsx:37` | selected list items | same palette keyed by `categoryId` (falls back to `categoryName`) — Badge `palette.badge` + chip `palette.buttonSelected` | Props `categoryId`, `showCategory` (default true), renders left-aligned `flex flex-col items-start gap-1`. Chip gets the same `hover:ring-2` emphasis ring. |

Both share the palette so catalog and list agree for the same category id. Never use `Button variant="success"` for selected state — palette is the source.

Other notable feature components: `ItemCatalog`, `ShoppingListPanel`, `PaletteChooser`, `QuickAddDialog`, `ThemeMenu`/`ThemeToggle`, `InstallBanner`/`InstallInstructionsDialog`, `BackButton`, `Footer`.

## 7. Motion

Tokens in `globals.css:79-96`; all respect reduced motion.

| Token | Duration / easing | Purpose |
|---|---|---|
| `animate-item-enter` / `animate-item-exit` | `0.18s ease-out` / `0.18s ease-in forwards` (`itemEnter` scale 0.92→1, fade) | catalog chip add/remove; also `motion-reduce:animate-none` |
| `animate-drawer-slide-in-*` | `0.5s cubic-bezier(0.32,0.72,0,1)` (4 directions) | `ItemDetailDrawer` (bottom default) |
| `animate-drawer-slide-out-*` | `0.3s cubic-bezier(0.4,0,0.2,1)` | drawer dismiss |
| `animate-expand` / `collapse` | `0.2s ease-out` | Accordion |
| `animate-slide-up` / `down` | `0.2s ease-out` (height `var(--height)` → 0) | collapsible regions |
| `animate-flip-in` / `out` | `0.2s ease-out` (rotateY) | flip tokens (present, lightly used) |
| `animate-marquee-x` / `y` | `var(--marquee-duration) linear infinite` | marquee primitives |
| `animate-indeterminate` | `1.5s ease-in-out` | progress |

View Transitions for item travel: per-item `view-transition-name` via `data-vt-catalog` / `data-vt-list`, root transition disabled (`::view-transition-old/new(root) {animation:none}`), group timing `cubic-bezier(0.4,0,0.2,1)` (`globals.css:552-575`). JS hook also bails on `prefers-reduced-motion`; CSS is the safety net.

## 8. Iconography

`@phosphor-icons/react` (`components.json` `iconLibrary: phosphor`) — menu/Toggle icons: `List, Plus, X, Clock, Info, Question, User, Rows, DownloadSimple`, theme icons `Sun/Moon/Monitor`, onboarding `DiceFive`. Size typical `16` in menus, `18–20` for header actions, `28` for dice. Keep to Phosphor; Lucide is installed but not used for UI.

## 9. Theming

Mode `light|dark|system` in `$theme` (`src/stores/theme.ts:1`, `persistentAtom` key `remindit:theme`, JSON-encoded with legacy fallback). `initTheme()` (`stores/theme.ts:36`) applies `dark` class + `colorScheme` on `<html>` and subscribes to store + `matchMedia("(prefers-color-scheme: dark)")`. Controls: `ThemeToggle` (cycles `ORDER [light,dark,system]`) and `ThemeMenu` (`MenuSub` → `MenuRadioGroup`) both call `setTheme`. PWA `colorScheme` and `::selection bg-primary/80` track the mode.

## 10. Accessibility

- `html antialiased`, global `* { border-border outline-ring/50 ring-ring }` (`globals.css:497`), visible focus via `ring`.
- `prefers-reduced-motion` respected for animations and view transitions (`motion-reduce:animate-none` + media query `animation:none`).
- `button:not(:disabled), [role="button"]:not(:disabled) {cursor:pointer}`; interactive elements carry `aria-label` (logo, avatar, add button, menu toggle, theme).
- Single Atkinson family chosen for hyperlegibility; contrast ink is WCAG-ratio-picked, not heuristic.
- Scrollbar: `scrollbar-thin overflow-y-scroll scrollbar-track-transparent scrollbar-thumb-foreground/20` on `body`; layout is keyboard-navigable Ark/Shark primitives.

## 11. Shape & Spacing

- **Radius:** `--radius 0.5rem` (`globals.css:320`), scaled `xs 0.25× → 4xl 4×` (`globals.css:70-77`). Typical Cards/menus/bars use `rounded-md` (`0.375rem`) and header/list panels `rounded-md border`. Utility classes `.radius-none/.radius-xs/.radius-sm/.radius-md/.radius-lg` override via `--radius`.
- **Header height:** `--header-height: calc(var(--spacing) * 14)` (`globals.css:7`) — 56px at default spacing.
- **Selection:** `::selection bg-primary/80 text-primary-foreground`.
- **Step utility:** `@utility step` with `counter(step)` circled `size-6 md:size-8` badge — used in help/onboarding flows.

## 12. File Map (where design lives)

| Concern | File |
|---|---|
| Tokens, keyframes, utilities | `src/styles/globals.css` |
| PWA brand colors | `pwa-manifest.config.ts` |
| Tailwind/Shark config | `components.json` |
| Categorical pool | `seed/palettes.json` + `src/lib/palettes.ts` |
| Palette → CSS vars | `src/lib/category-palette.ts` + `src/hooks/use-category-palette.ts` |
| Active palette store | `src/stores/palette.ts` |
| Theme store | `src/stores/theme.ts` |
| Header / nav | `src/components/menu.tsx` |
| Panels / catalog / list | `src/components/shopping-panels.tsx`, `item-catalog.tsx`, `shopping-list-panel.tsx` |
| Item chips | `src/components/ui/custom/item-button.tsx`, `src/components/shopping-item.tsx` |
| Views (shell for layout) | `src/views/*` |
| Icons | Phosphor (`package.json` `@phosphor-icons/react`) |

## 13. Conventions for Contributors

- Add primitives via `bunx shadcn add @shark/<name>`; if forking, move to `src/components/ui/custom/` and document the divergence (see button case).
- Color new UI with semantic tokens (`bg-primary`, `text-muted-foreground`, `border-input`) — do not introduce ad-hoc hex or `dark:` pairs. For anything categorized, use `useCategoryPalette`.
- Keep motion on the approved tokens; gate new animations behind `motion-reduce:animate-none` and verify with `prefers-reduced-motion`.
- Persist any new user preference via `@nanostores/persistent` under `remindit:` and expose a hook that subscribes to it (pattern: `palette.ts` + `use-category-palette.ts`).
- `bun run lint` (Biome) before committing; `bun run build` must pass. No secrets in `.env` commits.
