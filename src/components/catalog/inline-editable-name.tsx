import { useId } from "react"
import {
  Editable,
  EditableArea,
  EditableInput,
  EditablePreview,
} from "@/components/ui/editable"

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

// Click-to-edit name field built on Shark's Editable. Commits on Enter or
// blur; an empty or unchanged value is ignored so the store write is skipped
// and the controlled `value` (the source of truth) is restored automatically.
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

  return (
    <Editable
      value={value}
      disabled={disabled}
      activationMode="click"
      submitMode="both"
      placeholder={placeholder}
      onValueChange={() => {}}
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
    </Editable>
  )
}
