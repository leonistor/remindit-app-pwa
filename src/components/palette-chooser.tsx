// Palette chooser for Settings (Phase 3, sub-phase 3).
//
// Lists every palette in the pool as a selectable card in an inline Listbox, and
// shows a live preview of sample category chips recolored with the currently
// selected palette so users can judge real contrast before committing.
// Selection is persisted via `setActivePalette` (src/stores/palette).

import { useStore } from "@nanostores/react"
import { createListCollection } from "@/components/ui/custom/collection"
import {
  Listbox,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
} from "@/components/ui/listbox"
import { categoryPalette } from "@/lib/category-palette"
import { getPalette, PALETTE_POOL, type Palette } from "@/lib/palettes"
import { cn } from "@/lib/utils"
import { $activePaletteId, setActivePalette } from "@/stores/palette"

// Fixed demo categories used purely to preview the active palette's contrast.
const SAMPLE_CATEGORIES = ["Produce", "Dairy", "Bakery", "Beverages", "Frozen"]

// Listbox needs a flat collection; the value is the palette id and the visible
// label is the palette name.
const collection = createListCollection({
  items: PALETTE_POOL.palettes,
  itemToValue: (palette) => palette.id,
  itemToString: (palette) => palette.name,
})

// A single preview chip. `categoryPalette` is pure; the parent passes the active
// palette (resolved from the same store the chooser sets), so each chip recolors
// live when the palette changes.
function PreviewChip({ name, palette }: { name: string; palette: Palette }) {
  const resolved = categoryPalette(name, undefined, palette)
  return (
    <span
      className={cn("rounded-full px-3 py-1 text-sm", resolved.button)}
      style={resolved.style}
    >
      {name}
    </span>
  )
}

export const PaletteChooser = () => {
  const activeId = useStore($activePaletteId)
  const activePalette: Palette =
    getPalette(activeId) ?? PALETTE_POOL.palettes[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">Preview</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_CATEGORIES.map((name) => (
            <PreviewChip key={name} name={name} palette={activePalette} />
          ))}
        </div>
      </div>

      <Listbox
        collection={collection}
        value={[activeId]}
        onValueChange={(details) => setActivePalette(details.value[0])}
        aria-label="Category color palette"
      >
        <ListboxContent className="gap-3">
          {collection.items.map((palette) => (
            <ListboxItem
              key={palette.id}
              item={palette}
              className={cn(
                "group w-full flex-col items-stretch gap-3 rounded-xl border border-input p-3",
                "data-[state=checked]:border-primary data-[state=checked]:bg-transparent"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-sm">{palette.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {palette.source}
                  </span>
                </div>
                <ListboxItemIndicator className="size-4" />
              </div>
              <div className="flex gap-1" aria-hidden>
                {palette.colors.map((color) => (
                  <span
                    key={color.hex}
                    className="h-4 flex-1 rounded-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </ListboxItem>
          ))}
        </ListboxContent>
      </Listbox>
    </div>
  )
}
