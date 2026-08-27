// Palette chooser for Settings (Phase 3, sub-phase 3).
//
// Lists every palette in the pool as a selectable radio card with a 12-color
// preview strip, and a live preview of sample category chips recolored with the
// currently selected palette so users can judge real contrast before committing.
// Selection is persisted via `setActivePalette` (src/stores/palette).

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { categoryPalette } from "@/lib/category-palette"
import { cn } from "@/lib/utils"
import { getPalette, PALETTE_POOL, type Palette } from "@/lib/palettes"
import { useStore } from "@nanostores/react"
import { $activePaletteId, setActivePalette } from "@/stores/palette"

// Fixed demo categories used purely to preview the active palette's contrast.
const SAMPLE_CATEGORIES = ["Produce", "Dairy", "Bakery", "Beverages", "Frozen"]

// A single preview chip. `categoryPalette` is pure; we pass the active palette
// resolved by the parent (which subscribes to the same store the chooser sets),
// so each chip recolors live when the palette changes.
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
      <RadioGroup
        aria-label="Category color palette"
        value={activeId}
        onValueChange={(details) => setActivePalette(details.value)}
        className="gap-3"
      >
        {PALETTE_POOL.palettes.map((palette) => (
          <RadioGroupItem
            key={palette.id}
            value={palette.id}
            // `RadioGroupItem` wraps its children in an inline label; force that
            // label to be a full-width flex container so the card fills the row.
            className="group w-full gap-3 [&_[data-slot=radio-group-item-text]]:flex [&_[data-slot=radio-group-item-text]]:w-full"
          >
            <div className="w-full rounded-lg border border-input p-3 transition-colors group-data-[state=checked]:border-primary">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-medium text-sm">{palette.name}</span>
                <span className="text-muted-foreground text-xs">
                  {palette.source}
                </span>
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
            </div>
          </RadioGroupItem>
        ))}
      </RadioGroup>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">Preview</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_CATEGORIES.map((name) => (
            <PreviewChip key={name} name={name} palette={activePalette} />
          ))}
        </div>
      </div>
    </div>
  )
}
