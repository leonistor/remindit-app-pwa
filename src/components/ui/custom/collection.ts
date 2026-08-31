// Sanctioned Ark re-export seam for collection utilities.
//
// Lives in `ui/custom/` (NOT the registry-managed `ui/` root) because
// `src/components/ui/*` files are CLI-tracked from the Shark registry —
// regenerating them would clobber or drop hand-maintained additions. This
// module is the sanctioned exception where feature code may "touch" Ark: it
// imports from `@ark-ui/react` and re-exports, so no feature component imports
// Ark directly (see docs/DEV.md §UI components, rule against raw Ark imports).
//
// Export names verified against @ark-ui/react 5.x root exports (`useFilter`
// via providers/locale; collection helpers via combobox/select re-exports).
export {
  createListCollection,
  type ListCollection,
  useFilter,
  useListCollection,
} from "@ark-ui/react"
