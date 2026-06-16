import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  applyFieldValidationErrors,
  AuthEmailField,
  AuthPasswordField,
  AuthSubmitButton,
} from "./authShared"
import { ApiError } from "@/lib/apiClient"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

import { toast } from "sonner"

// ─── applyFieldValidationErrors ───────────────────────────────────────────────

describe("applyFieldValidationErrors", () => {
  it("returns false and does not call setFieldErrors when status is not 400", () => {
    const setFieldErrors = vi.fn()
    const err = new ApiError(500, "Internal Server Error")
    const result = applyFieldValidationErrors(err, setFieldErrors)
    expect(result).toBe(false)
    expect(setFieldErrors).not.toHaveBeenCalled()
  })

  it("returns false when err.errors is undefined even with status 400", () => {
    const setFieldErrors = vi.fn()
    const err = new ApiError(400, "Bad Request")
    const result = applyFieldValidationErrors(err, setFieldErrors)
    expect(result).toBe(false)
    expect(setFieldErrors).not.toHaveBeenCalled()
  })

  it("extracts email error from errors map and returns true", () => {
    const setFieldErrors = vi.fn()
    const err = new ApiError(400, "Validation failed", { email: ["Email is invalid"] })
    const result = applyFieldValidationErrors(err, setFieldErrors)
    expect(result).toBe(true)
    expect(setFieldErrors).toHaveBeenCalledWith({ email: "Email is invalid" })
  })

  it("extracts password error from errors map and returns true", () => {
    const setFieldErrors = vi.fn()
    const err = new ApiError(400, "Validation failed", { password: ["Password too short"] })
    const result = applyFieldValidationErrors(err, setFieldErrors)
    expect(result).toBe(true)
    expect(setFieldErrors).toHaveBeenCalledWith({ password: "Password too short" })
  })

  it("calls toast.error with err.detail when neither email nor password error is present", () => {
    const setFieldErrors = vi.fn()
    const err = new ApiError(400, "Something went wrong", { other: ["Some other error"] })
    const result = applyFieldValidationErrors(err, setFieldErrors)
    expect(result).toBe(true)
    expect(toast.error).toHaveBeenCalledWith("Something went wrong")
  })

  it("does not call toast.error when at least one field error is present", () => {
    vi.mocked(toast.error).mockClear()
    const setFieldErrors = vi.fn()
    const err = new ApiError(400, "Bad Request", { email: ["Email taken"] })
    applyFieldValidationErrors(err, setFieldErrors)
    expect(toast.error).not.toHaveBeenCalled()
  })
})

// ─── AuthEmailField ───────────────────────────────────────────────────────────

describe("AuthEmailField", () => {
  it("renders email input with correct placeholder", () => {
    render(
      <AuthEmailField value="" onChange={vi.fn()} disabled={false} />
    )
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument()
  })

  it("renders field error message when fieldError is provided", () => {
    render(
      <AuthEmailField value="" onChange={vi.fn()} fieldError="Email is required" disabled={false} />
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required")
  })

  it("does not render error message when fieldError is absent", () => {
    render(
      <AuthEmailField value="" onChange={vi.fn()} disabled={false} />
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("disables the input when disabled=true", () => {
    render(
      <AuthEmailField value="" onChange={vi.fn()} disabled={true} />
    )
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled()
  })
})

// ─── AuthPasswordField ────────────────────────────────────────────────────────

describe("AuthPasswordField", () => {
  it("renders password input with provided placeholder", () => {
    render(
      <AuthPasswordField
        value=""
        onChange={vi.fn()}
        disabled={false}
        autoComplete="current-password"
        placeholder="Enter your password"
      />
    )
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument()
  })

  it("renders field error message when fieldError is provided", () => {
    render(
      <AuthPasswordField
        value=""
        onChange={vi.fn()}
        fieldError="Password is too short"
        disabled={false}
        autoComplete="new-password"
        placeholder="New password"
      />
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Password is too short")
  })

  it("does not render error message when fieldError is absent", () => {
    render(
      <AuthPasswordField
        value=""
        onChange={vi.fn()}
        disabled={false}
        autoComplete="new-password"
        placeholder="New password"
      />
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

// ─── AuthSubmitButton ─────────────────────────────────────────────────────────

describe("AuthSubmitButton", () => {
  it("renders the label when not submitting", () => {
    render(
      <AuthSubmitButton isSubmitting={false} label="Sign In" loadingLabel="Signing in…" />
    )
    expect(screen.getByRole("button")).toHaveTextContent("Sign In")
  })

  it("renders the loading label when submitting", () => {
    render(
      <AuthSubmitButton isSubmitting={true} label="Sign In" loadingLabel="Signing in…" />
    )
    expect(screen.getByRole("button")).toHaveTextContent("Signing in…")
  })

  it("disables the button when submitting", () => {
    render(
      <AuthSubmitButton isSubmitting={true} label="Sign In" loadingLabel="Signing in…" />
    )
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("does not disable the button when not submitting", () => {
    render(
      <AuthSubmitButton isSubmitting={false} label="Sign In" loadingLabel="Signing in…" />
    )
    expect(screen.getByRole("button")).not.toBeDisabled()
  })
})
