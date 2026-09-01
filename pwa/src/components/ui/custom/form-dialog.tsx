import type { ReactNode } from "react"
import { Button } from "@/components/ui/custom/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"

interface FormDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Called with the next open state (mirrors the underlying Dialog). */
  onOpenChange: (open: boolean) => void
  /** Dialog title. */
  title: string
  /** Optional supporting text under the title. */
  description?: string
  /** Invoked by the Save button; pass `undefined` to hide it. */
  onSave?: () => void
  /** Invoked by the Cancel button; defaults to closing the dialog. */
  onCancel?: () => void
  /** Save-button label. */
  saveLabel?: string
  /** Cancel-button label. */
  cancelLabel?: string
  /** Disables the Save button (e.g. while the form is invalid). */
  saveDisabled?: boolean
  /** Form body — typically a `FieldGroup` of `ValidatedField`s. */
  children: ReactNode
}

// Reusable modal frame for the app's add/edit dialogs. Collapses the repeated
// Dialog/Header/Body/Footer + cancel/save boilerplate shared by item and
// category dialogs into one place.
export const FormDialog = ({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  onCancel,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saveDisabled,
  children,
}: FormDialogProps) => (
  <Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
    <DialogContent>
      <DialogHeader title={title} description={description} />
      <DialogBody>{children}</DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => (onCancel ?? (() => onOpenChange(false)))()}
        >
          {cancelLabel}
        </Button>
        {onSave && (
          <Button onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
