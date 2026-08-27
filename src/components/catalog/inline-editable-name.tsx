import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useId, useState } from "react"
import {
  Editable,
  EditableArea,
  EditableCancelTrigger,
  EditableControl,
  EditableInput,
  EditablePreview,
  EditableSubmitTrigger,
  useEditable,
} from "@/components/ui/editable"
import { Button } from "@/components/ui/custom/button"

interface InlineEditableNameProps {
  /** Current name, shown in the preview and used as the controlled value. */
  value: string
  /** Called with the committed, trimmed name (only when non-empty + changed). */
  onCommit: (next: string) => void
  /** Placeholder shown when the name is empty. */
  placeholder?: string
  /** Accessible label for the editable control. */
  ariaLabel?: string
  /** Disable editing (e.g. the uncategorized sentinel). */
  disabled?: boolean
  /** Preview size (maps to the underlying button variant). */
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  /** Preview variant (maps to the underlying button variant). */
  variant?: "outline" | "bare" | "ghost"
  /** Extra classes for the preview (e.g. to enlarge the text). */
  className?: string
}

// Shows the submit/cancel buttons only while the editable is in edit mode.
// Rendered as a child of `Editable.Root` so the `useEditable` hook reads the
// surrounding context without importing `@ark-ui` directly.
const EditableActionControls = () => {
  const editable = useEditable()
  if (!editable.editing) return null

  return (
    <EditableControl>
      <EditableSubmitTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Save">
          <CheckIcon />
        </Button>
      </EditableSubmitTrigger>
      <EditableCancelTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Cancel">
          <XIcon />
        </Button>
      </EditableCancelTrigger>
    </EditableControl>
  )
}

// Click-to-edit name field built on Shark's Editable. Commits on Enter or
// blur; an empty or unchanged value is ignored so the store write is skipped
// and the controlled `value` (the source of truth) is restored automatically.
//
// The draft is mirrored into local state and fed back via `onValueChange`:
// Ark's Editable resets its internal value to the controlled `value` prop on
// every render, so without this round-trip the commit would read the stale
// original instead of what the user typed.
export const InlineEditableName = ({
  value,
  onCommit,
  placeholder,
  ariaLabel,
  disabled,
  size = "md",
  variant = "outline",
  className,
}: InlineEditableNameProps) => {
  const id = useId()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Editable
      value={draft}
      disabled={disabled}
      activationMode="click"
      submitMode="both"
      placeholder={placeholder}
      onValueChange={(details) => setDraft(details.value)}
      onValueCommit={(details) => {
        const next = details.value.trim()
        if (next.length > 0 && next !== value) onCommit(next)
      }}
      aria-label={ariaLabel}
    >
      <EditableArea>
        <EditablePreview
          id={id}
          size={size}
          variant={variant}
          aria-label={ariaLabel}
          className={className}
        />
        <EditableInput />
      </EditableArea>
      <EditableActionControls />
    </Editable>
  )
}
