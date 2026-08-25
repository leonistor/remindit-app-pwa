"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface DrawerContextValue {
  /** Whether the drawer is open. */
  open: boolean
  /** ID of the item being viewed, or null if no item selected. */
  itemId: string | null
  /** Open the drawer for a specific item. */
  openDrawer: (itemId: string) => void
  /** Close the drawer. */
  closeDrawer: () => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState<string | null>(null)

  const openDrawer = useCallback((id: string) => {
    setItemId(id)
    setOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <DrawerContext.Provider value={{ open, itemId, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawerContext(): DrawerContextValue {
  const ctx = useContext(DrawerContext)
  if (!ctx) {
    throw new Error("useDrawerContext must be used within a DrawerProvider")
  }
  return ctx
}
