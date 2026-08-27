"use client"

import { useStore } from "@nanostores/react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer"
import { $itemDetail, useDrawer } from "@/stores"

export const ItemDetailDrawer = () => {
  const { open, itemId, closeDrawer } = useDrawer()
  const { item, categoryName } = useStore($itemDetail(itemId))

  return (
    <Drawer open={open} onOpenChange={({ open }) => !open && closeDrawer()}>
      <DrawerContent swipeDirection="end">
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
