import { TrashIcon } from "@phosphor-icons/react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/custom/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-is-mobile"
import {
  type CatalogByCategoryItem,
  deleteCatalogItemWithCascade,
} from "@/stores"
import { ConfirmDelete } from "./confirm-delete"
import { SwipeableItemRow } from "./swipeable-item-row"

interface CategoryItemsTableProps {
  items: CatalogByCategoryItem[]
  onEditItem: (item: CatalogByCategoryItem) => void
}

// Renders a category's items. On desktop: Shark Table with double-click to edit
// and a delete button behind a confirmation dialog. On mobile: stacked cards
// where a single tap edits and a left swipe reveals delete (tap to confirm).
export const CategoryItemsTable = ({
  items,
  onEditItem,
}: CategoryItemsTableProps) => {
  const isMobile = useIsMobile()
  const [pendingDelete, setPendingDelete] =
    useState<CatalogByCategoryItem | null>(null)

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No items yet.</p>
  }

  const handleEdit = (item: CatalogByCategoryItem) => onEditItem(item)

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    deleteCatalogItemWithCascade(pendingDelete.id)
    setPendingDelete(null)
  }

  // Mobile: swipe-to-reveal list
  if (isMobile) {
    return (
      <>
        <div className="flex flex-col gap-2 pt-2">
          {items.map((item) => (
            <SwipeableItemRow
              key={item.id}
              enabled
              deleteLabel={`Delete ${item.name}`}
              onDelete={() => setPendingDelete(item)}
            >
              {/* Tap to edit, keyboard Enter to edit */}
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Edit ${item.name} (tap to edit)`}
                onClick={() => handleEdit(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleEdit(item)
                  }
                }}
              >
                <span className="block truncate">{item.name}</span>
              </button>
            </SwipeableItemRow>
          ))}
        </div>

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(details) => {
            if (!details.open) setPendingDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader
              title={
                pendingDelete
                  ? `Delete "${pendingDelete.name}"?`
                  : "Delete item?"
              }
              description="This will also remove it from your shopping list. This cannot be undone."
            />
            <AlertDialogFooter>
              <AlertDialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogClose>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete item
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // Desktop: table with double-click to edit
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Delete</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="p-0">
                <button
                  type="button"
                  className="w-full px-2 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Edit ${item.name} (double-click to edit)`}
                  title="Double-click to edit"
                  onDoubleClick={() => handleEdit(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleEdit(item)
                    }
                  }}
                >
                  <span className="block truncate">{item.name}</span>
                </button>
              </TableCell>
              <TableCell className="text-right">
                <ConfirmDelete
                  title={`Delete "${item.name}"?`}
                  description="This will also remove it from your shopping list. This cannot be undone."
                  confirmLabel="Delete item"
                  onConfirm={() => deleteCatalogItemWithCascade(item.id)}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${item.name}`}
                  >
                    <TrashIcon />
                  </Button>
                </ConfirmDelete>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Fallback controlled dialog for delete triggered via swipe state (desktop path doesn't use swipe, but keep for consistency) */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(details) => {
          if (!details.open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader
            title={
              pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete item?"
            }
            description="This will also remove it from your shopping list. This cannot be undone."
          />
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete item
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
