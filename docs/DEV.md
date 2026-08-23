# development

## State architecture

App state lives in **framework-agnostic [nanostores](https://github.com/nanostores/nanostores)** under `src/stores/`. No React imports there — components consume stores via `@nanostores/react`'s `useStore`. This keeps the store layer reusable and easy to test.

All collections are persisted to `localStorage` with `@nanostores/persistent` (key prefix `remindit:`).

### Model: Catalog + active list

- **Catalog** (`$catalog`) — the master pool of every known item `{ id, name, categoryId }`.
- **List** (`$list`) — the currently active shopping list. Each entry `{ id, itemId, checked, addedAt }` references a catalog item and tracks a `checked` state for shopping progress.
- **Categories** (`$categories`) — `{ id, name }`. An `uncategorized` sentinel category always exists and is the destination when another category is deleted (so items are never orphaned).
- **History** (`$history`) — a pure log of shopping events `{ id, action: 'add' | 'remove', itemId, itemName, categoryId, timestamp }`.
- **User** (`$user`) — `{ name, photo }`, assigned random defaults on first run.

### Store modules (`src/stores/`)

| File            | Exposes                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`      | Shared types + `UNCATEGORIZED_ID` / naming constants                                                                         |
| `categories.ts` | `$categories`, `addCategory`, `renameCategory`, `removeCategory`, `getCategory`, `ensureUncategorizedExists`                 |
| `catalog.ts`    | `$catalog`, `addCatalogItem`, `updateCatalogItem`, `removeCatalogItem`, `getCatalogItem`                                     |
| `list.ts`       | `$list`, `addToList`, `removeFromList`, `setEntryChecked`, `clearList`, `createItemAndAddToList`, `removeListEntriesForItem` |
| `history.ts`    | `$history`, `logHistory`, `clearHistory`                                                                                     |
| `user.ts`       | `$user`, `getUser`, `updateUser`, `randomUser`                                                                               |
| `selectors.ts`  | computed `$itemsByCategory`, `$activeCategoryIds`, `$listCount`, `$checkedCount`                                             |
| `index.ts`      | Barrel exports + `initStores()` (seeds sample data, random user, dev logger)                                                 |

Import everything from the barrel: `import { $list, addToList } from "@/stores"`.

### Invariants

- **History logs only `add`/`remove`-from-list.** `addToList` → `logHistory('add')`; `removeFromList` → `logHistory('remove')`. Editing or deleting catalog items and deleting/renaming categories deliberately **do not** write history — those callers simply never call `logHistory`.
- **Deleting a catalog item** also drops any active list entries referencing it (cascade, no history).
- **Deleting a category** reassigns its catalog items to `uncategorized` (no history, no orphans). The sentinel itself cannot be deleted or renamed.

### Seeding

On first run, `initStores()` (called automatically when `src/stores/index.ts` is imported) seeds `$categories` and `$catalog` from `seed/items_categories.json` (relocated to the repo-root `seed/` directory; a typed, deterministic-id loader lives at `seed/index.ts`) if the catalog is empty, and assigns a random `$user` if no name is set. Re-running is a no-op once populated.

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
```
