import { type ReactNode, useState } from "react"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/custom/button"
import { m } from "@/paraglide/messages"

interface ConfirmDeleteProps {
  /** Dialog title (e.g. "Delete category?"). */
  title: string
  /** Explanatory text shown under the title. */
  description: string
  /** Label for the destructive confirm button. */
  confirmLabel?: string
  /** Called when the user confirms. */
  onConfirm: () => void
  /** The trigger element (typically an icon Button). */
  children: ReactNode
}

// Wraps Shark's AlertDialog for a single destructive confirmation. The dialog is
// controlled so we can also fire `onConfirm` on the same click that closes it.
export const ConfirmDelete = ({
  title,
  description,
  // Default param resolves per call, so the label follows the active language.
  confirmLabel = m.delete(),
  onConfirm,
  children,
}: ConfirmDeleteProps) => {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={(details) => setOpen(details.open)}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader title={title} description={description} />
        <AlertDialogFooter>
          <AlertDialogClose asChild>
            <Button variant="outline">{m.cancel()}</Button>
          </AlertDialogClose>
          <AlertDialogClose asChild>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm()
                setOpen(false)
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
