import { useStore } from "@nanostores/react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer"
import { $itemDetail, useDrawer } from "@/stores"

// Phase 3 stub. `openDrawer` (from drawer-context) is intentionally not wired
// into the catalog/item UI yet: item buttons already own primary actions
// (select / remove), and this drawer only renders placeholder content. Once
// real item attributes exist, call `openDrawer(itemId)` from the item UI and
// fill in the body below.
export const ItemDetailDrawer = () => {
  const { open, itemId, closeDrawer } = useDrawer()
  const { item, categoryName } = useStore($itemDetail(itemId))

  return (
    <Drawer
      open={open}
      swipeDirection="end"
      onOpenChange={({ open }) => !open && closeDrawer()}
    >
      <DrawerContent>
        <DrawerHeader
          title={item?.name ?? "Item details"}
          description={categoryName}
        />
        <DrawerBody>
          {/* Phase 3: item attributes — photo, quantity, price */}
          <p className="text-muted-foreground text-sm">
            Item details will appear here.
          </p>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
