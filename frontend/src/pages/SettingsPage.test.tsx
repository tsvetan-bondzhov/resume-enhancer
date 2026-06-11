import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SettingsPage from "./SettingsPage"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    put: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SettingsPage", () => {
  it("shows mismatch error and makes no API call when passwords differ", async () => {
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText(/Current password/i), "myoldpass")
    await userEvent.type(screen.getByLabelText(/^New password/i), "newpass123")
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "different123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match")
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it("clears mismatch error only when confirm password matches new password", async () => {
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText(/Current password/i), "myoldpass")
    await userEvent.type(screen.getByLabelText(/^New password/i), "newpass123")
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "different123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match")

    // Partial correction — error should remain while values still differ
    const confirmInput = screen.getByLabelText(/Confirm new password/i)
    await userEvent.clear(confirmInput)
    await userEvent.type(confirmInput, "newpass")
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match")

    // Full match — error should clear when confirm equals new password
    await userEvent.clear(confirmInput)
    await userEvent.type(confirmInput, "newpass123")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("calls API and shows success toast on valid submission", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce(undefined)
    render(<SettingsPage />)
    await userEvent.type(screen.getByLabelText(/Current password/i), "myoldpass")
    await userEvent.type(screen.getByLabelText(/^New password/i), "newpass123")
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "newpass123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/v1/users/me/password",
        { currentPassword: "myoldpass", newPassword: "newpass123" }
      )
      expect(toast.success).toHaveBeenCalledWith("Password changed successfully")
    })
  })

  it("resets all fields to empty after successful submission", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce(undefined)
    render(<SettingsPage />)
    const currentInput = screen.getByLabelText(/Current password/i)
    const newInput = screen.getByLabelText(/^New password/i)
    const confirmInput = screen.getByLabelText(/Confirm new password/i)
    await userEvent.type(currentInput, "myoldpass")
    await userEvent.type(newInput, "newpass123")
    await userEvent.type(confirmInput, "newpass123")
    await userEvent.click(screen.getByRole("button", { name: /Change Password/i }))
    await waitFor(() => {
      expect(currentInput).toHaveValue("")
      expect(newInput).toHaveValue("")
      expect(confirmInput).toHaveValue("")
    })
  })
})
