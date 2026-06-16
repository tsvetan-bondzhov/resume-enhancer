import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/apiClient"

// ─── Shared auth field-error types ────────────────────────────────────────────

export interface FieldErrors {
  email?: string
  password?: string
}

// ─── Shared 400 validation-error handler ──────────────────────────────────────
// Parses field-level errors from a 400 response and calls setFieldErrors.
// Returns true if the error was handled, false otherwise.

export function applyFieldValidationErrors(
  err: ApiError,
  setFieldErrors: (e: FieldErrors) => void,
): boolean {
  if (err.status === 400 && err.errors) {
    const errors: FieldErrors = {}
    if (err.errors["email"]?.[0]) errors.email = err.errors["email"][0]
    if (err.errors["password"]?.[0]) errors.password = err.errors["password"][0]
    setFieldErrors(errors)
    if (!errors.email && !errors.password) {
      toast.error(err.detail)
    }
    return true
  }
  return false
}

// ─── Email field ───────────────────────────────────────────────────────────────

interface AuthEmailFieldProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly fieldError?: string
  readonly disabled: boolean
}

export function AuthEmailField({ value, onChange, fieldError, disabled }: AuthEmailFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="email" className="text-sm font-medium leading-none">
        Email
      </label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? "email-error" : undefined}
        disabled={disabled}
      />
      {fieldError && (
        <p id="email-error" role="alert" className="text-sm text-red-600">
          {fieldError}
        </p>
      )}
    </div>
  )
}

// ─── Password field ────────────────────────────────────────────────────────────

interface AuthPasswordFieldProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly fieldError?: string
  readonly disabled: boolean
  readonly autoComplete: string
  readonly placeholder: string
}

export function AuthPasswordField({
  value,
  onChange,
  fieldError,
  disabled,
  autoComplete,
  placeholder,
}: AuthPasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="password" className="text-sm font-medium leading-none">
        Password
      </label>
      <Input
        id="password"
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? "password-error" : undefined}
        disabled={disabled}
      />
      {fieldError && (
        <p id="password-error" role="alert" className="text-sm text-red-600">
          {fieldError}
        </p>
      )}
    </div>
  )
}

// ─── Submit button ─────────────────────────────────────────────────────────────

interface AuthSubmitButtonProps {
  readonly isSubmitting: boolean
  readonly label: string
  readonly loadingLabel: string
}

export function AuthSubmitButton({ isSubmitting, label, loadingLabel }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={isSubmitting}>
      {isSubmitting ? (
        <>
          <Loader2 className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}
