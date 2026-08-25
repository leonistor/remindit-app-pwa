"use client"

import { useStore } from "@nanostores/react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer"
import { useDrawerContext } from "@/components/drawer-context"
import { $catalog, $categories } from "@/stores"
import { UNCATEGORIZED_NAME } from "@/stores/types"

export const ItemDetailDrawer = () => {
  const { open, itemId, closeDrawer } = useDrawerContext()
  const catalog = useStore($catalog)
  const categories = useStore($categories)

  const item = catalog.find((i) => i.id === itemId)
  const category = categories.find((c) => c.id === item?.categoryId)

  return (
    <Drawer open={open} onOpenChange={({ open }) => !open && closeDrawer()}>
      <DrawerContent swipeDirection="end">
        <DrawerHeader
          title={item?.name ?? "Item details"}
          description={category?.name ?? UNCATEGORIZED_NAME}
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
