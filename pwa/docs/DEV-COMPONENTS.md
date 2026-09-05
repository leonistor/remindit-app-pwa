# UI components — registry vs. custom

This document supplements [`DEV.md`](./DEV.md) and [`DESIGN.md`](../DESIGN.md) (§6) and explains how our Shark UI components are
split between **registry-managed** primitives and **hand-maintained / derived** components,
plus the findings from the latest upstream update check.

## Folder layout

| Path | Ownership | How it's maintained |
| --- | --- | --- |
| `src/components/ui/*` | Shark UI registry | Added/updated via `bunx shadcn add @shark/<component>` (CLI-tracked, see `components.json`). |
| `src/components/ui/custom/*` | Project | Hand-maintained. **Never** regenerate these from the registry. |

Rule of thumb:

- A new **Shark primitive** belongs in `src/components/ui/`.
- A **project-specific derivative** or a Shark primitive we had to fork (added variants, changed
  behavior) belongs in `src/components/ui/custom/`.

## Components in `ui/custom/`

### `button.tsx` — derived from Shark `base-nova` button

This is our fork of the official `@shark/button`. It keeps two extra variants that the
`@shark` registry HEAD would drop — they are retained so a regeneration can't silently
remove them, but **item/category coloring no longer uses them**: `ItemButton` and
`ShoppingItem` both render `<Button variant="bare">` and apply their own palette tokens
via `categoryPalette` (see `DEV.md`).

- `success` — retained but **unused** by feature components.
- `info` — retained but **unused** by feature components.

> **⚠️ Guardrail:** The current `@shark` registry HEAD **removes** the `success` and `info`
> variants. Running `bunx shadcn add @shark/button` (or `--overwrite`) would recreate
> `src/components/ui/button.tsx` **without** those variants and **break the build**.
> Do **not** run that command. Any upstream button fix must be ported in by hand while keeping
> these variants.

### `item-button.tsx` — project-custom

Catalog item button (applies the categorical palette via `categoryPalette` + a recommendation dot).
**Not** in the `@shark` registry. Imports the sibling `./button` (our custom fork) so it gets the
`bare` variant the palette tokens are applied to, and so the retained `success` / `info` variants
stay available.

### `form-dialog.tsx` — project-custom

Dialog scaffolding for create/edit flows (`FormDialog`): a Shark `Dialog` wrapper that pairs a body
slot with Cancel/Save footer buttons (`onSave`/`onCancel`, overridable labels). **Not** in the
`@shark` registry. Builds on the registry `dialog` primitive and the custom `button` fork.

### `validated-field.tsx` — project-custom

Labelled, validation-aware field wrapper (`ValidatedField`): keeps the `Field` + `FieldLabel` +
`FieldError` triad consistent across dialogs (`invalid` + `error` props drive the error state).
**Not** in the `@shark` registry. Builds on the registry `field` primitive.

### `collection.ts` — project-custom (Ark re-export seam)

Re-exports Ark UI collection utilities (`createListCollection`, `createGridCollection`, `useFilter`,
…) from `@ark-ui/react` / `@ark-ui/react/collection`. This is the **one sanctioned seam where the
"no raw Ark imports in feature code" rule bends**: feature components import these helpers from here
(`ui/custom/collection`), never from `@ark-ui/react` directly. It lives in `ui/custom/` — not the
CLI-tracked `ui/` root — so a registry regeneration can't clobber it.

## Latest upstream update check (findings)

Checked every component in `src/components/ui/*` with:

```bash
bunx shadcn@latest add @shark/<component> --diff
```

The shadcn CLI diffs the local file against the registry HEAD and even auto-flags pure formatting
drift as *"Formatting-only changes (spacing, quotes, semicolons)"*. shadcn has **no versioning**, so
"an update" just means registry HEAD vs. our file.

Results:

- **The registry components** (now including `float`, added via the CLI for the floating sort button,
  and the `autocomplete` feature's peer primitives `combobox`, `textarea`, `input`, `input-group`,
  `separator`) all differ from HEAD **only in formatting** (trailing semicolons, quote style, spacing)
  — cosmetic biome drift, **not** functional changes. There are no beneficial feature updates to apply.
  These components are CLI-tracked like the rest of `src/components/ui/*` and may be updated with
  `bunx shadcn add @shark/<component>` (do **not** `--overwrite` `button` — see guardrail below).
- **`button.tsx` is the only file with a real structural delta**, and it is a **regression**: the
  registry would delete `success`/`info` (see guardrail above). It lives in `ui/custom/`, not the
  registry path, precisely so it is not clobbered.
- **`item-button.tsx`, `form-dialog.tsx`, `validated-field.tsx`, and
  `collection.ts` are not in the registry** (project-custom) — there is no CLI update path for them.

### `components.json` caveat

`components.json` carries no per-component install list, so the CLI has no memory that `button` was
moved to `custom/`. A future `shadcn add @shark/button` would happily recreate a registry
`button.tsx` at `src/components/ui/button.tsx` and reintroduce the missing-variant breakage. Treat
`button` as **custom** and don't run that command.

## Safe update workflow

1. Inspect, don't overwrite: `bunx shadcn add @shark/<c> --diff`.
2. For a registry component, apply only the **non-formatting, non-breaking** hunks by hand.
3. Never pass `--overwrite` without explicit review.
4. After any edit: `bun run lint` + `bun run build`.
5. `button`, `item-button`, `form-dialog`, `validated-field`, and `collection` are **out of scope** for the CLI — edit them directly.
