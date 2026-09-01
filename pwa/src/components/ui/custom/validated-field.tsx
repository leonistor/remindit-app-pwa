import type { ReactNode } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

interface ValidatedFieldProps {
  /** Field label shown above the control. */
  label: string
  /** Marks the field invalid, triggering the error message + styling. */
  invalid?: boolean
  /** Error text rendered when `invalid` is true. */
  error?: string
  /** The control (Input, Select, …). */
  children: ReactNode
}

// Labelled, validation-aware field wrapper. Keeps the Field + FieldLabel +
// FieldError triad consistent across every dialog without each one repeating it.
export const ValidatedField = ({
  label,
  invalid,
  error,
  children,
}: ValidatedFieldProps) => (
  <Field invalid={invalid}>
    <FieldLabel>{label}</FieldLabel>
    {children}
    {invalid && error && <FieldError>{error}</FieldError>}
  </Field>
)
