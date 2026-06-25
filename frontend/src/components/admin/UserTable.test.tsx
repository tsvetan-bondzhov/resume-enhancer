import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminUserDto, Page } from "@/types/api"
import UserTable from "./UserTable"
import { apiClient } from "@/lib/apiClient"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSetAuth = vi.fn()
vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (selector?: (s: { setAuth: typeof mockSetAuth }) => unknown) => {
    const state = { setAuth: mockSetAuth }
    return selector ? selector(state) : state
  },
}))

import { toast } from "sonner"

const mockedGet = vi.mocked(apiClient.get)
const mockedPatch = vi.mocked(apiClient.patch)
const mockedPost = vi.mocked(apiClient.post)

function buildUser(overrides?: Partial<AdminUserDto>): AdminUserDto {
  return {
    id: "u1",
    email: "alice@example.com",
    role: "USER",
    status: "ACTIVE",
    createdAt: "2026-01-15T10:00:00Z",
    ...overrides,
  }
}

function buildPage(content: AdminUserDto[]): Page<AdminUserDto> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
  }
}

describe("UserTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and renders user rows from the page response", async () => {
    mockedGet.mockResolvedValue(
      buildPage([
        buildUser({ id: "u1", email: "alice@example.com", role: "USER" }),
        buildUser({ id: "u2", email: "bob@example.com", role: "ADMIN", status: "INACTIVE" }),
      ]),
    )

    render(<UserTable />)

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users")
  })

  it("does not render an enabled Deactivate action for an INACTIVE user", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u2", email: "bob@example.com", status: "INACTIVE" })]),
    )

    render(<UserTable />)
    await screen.findByText("bob@example.com")

    expect(screen.queryByRole("button", { name: /deactivate/i })).not.toBeInTheDocument()
  })

  it("opens the confirm dialog with the email-specific copy when Deactivate is clicked", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com" })]),
    )
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /deactivate/i }))

    expect(
      screen.getByText("Deactivate alice@example.com? Their resumes will be preserved."),
    ).toBeInTheDocument()
  })

  it("confirming calls PATCH, updates the row to Inactive, and fires success toast", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com", status: "ACTIVE" })]),
    )
    mockedPatch.mockResolvedValue(
      buildUser({ id: "u1", email: "alice@example.com", status: "INACTIVE" }),
    )
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /deactivate/i }))
    // Confirm button inside the dialog footer
    const confirmButtons = screen.getAllByRole("button", { name: /deactivate/i })
    await user.click(confirmButtons.at(-1)!)

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith("/api/v1/admin/users/u1/deactivate")
    })
    expect(toast.success).toHaveBeenCalledWith("User deactivated")
    expect(await screen.findByText("Inactive")).toBeInTheDocument()
    // Row action becomes hidden once inactive
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^deactivate$/i })).not.toBeInTheDocument()
    })
  })

  it("Cancel closes the dialog without calling PATCH", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com" })]),
    )
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /deactivate/i }))
    expect(screen.getByText(/their resumes will be preserved/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText(/their resumes will be preserved/i)).not.toBeInTheDocument()
    })
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it("shows an error toast and leaves the row unchanged when PATCH fails", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com", status: "ACTIVE" })]),
    )
    mockedPatch.mockRejectedValue(new Error("boom"))
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /deactivate/i }))
    const confirmButtons = screen.getAllByRole("button", { name: /deactivate/i })
    await user.click(confirmButtons.at(-1)!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to deactivate user")
    })
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("renders Activate for an INACTIVE user and PATCHes to activate it", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u2", email: "bob@example.com", status: "INACTIVE" })]),
    )
    mockedPatch.mockResolvedValue(
      buildUser({ id: "u2", email: "bob@example.com", status: "ACTIVE" }),
    )
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("bob@example.com")

    await user.click(screen.getByRole("button", { name: /activate/i }))

    await waitFor(() => {
      expect(mockedPatch).toHaveBeenCalledWith("/api/v1/admin/users/u2/activate")
    })
    expect(toast.success).toHaveBeenCalledWith("User activated")
    expect(await screen.findByText("Active")).toBeInTheDocument()
  })

  it("filters users by email, role, and status, and shows the empty state for no matches", async () => {
    mockedGet.mockResolvedValue(
      buildPage([
        buildUser({ id: "u1", email: "alice@example.com", role: "USER", status: "ACTIVE" }),
        buildUser({ id: "u2", email: "bob@example.com", role: "ADMIN", status: "INACTIVE" }),
      ]),
    )
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    const searchBox = screen.getByLabelText(/search users/i)

    // Filter by email
    await user.type(searchBox, "alice")
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument()

    // Filter by role
    await user.clear(searchBox)
    await user.type(searchBox, "admin")
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument()

    // Filter by status
    await user.clear(searchBox)
    await user.type(searchBox, "inactive")
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument()

    // Non-matching query shows empty state
    await user.clear(searchBox)
    await user.type(searchBox, "zzz-no-match")
    expect(screen.getByText("No users found.")).toBeInTheDocument()
  })

  it("does not render Impersonate for an INACTIVE user", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u2", email: "bob@example.com", status: "INACTIVE" })]),
    )

    render(<UserTable />)
    await screen.findByText("bob@example.com")

    expect(screen.queryByRole("button", { name: /impersonate/i })).not.toBeInTheDocument()
  })

  it("Impersonate POSTs, stores the returned token, and navigates home", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com", status: "ACTIVE" })]),
    )
    mockedPost.mockResolvedValue({
      token: "impersonation-token",
      user: { id: "u1", email: "alice@example.com", role: "USER" },
    })
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /impersonate/i }))

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith("/api/v1/admin/users/u1/impersonate", {})
    })
    expect(mockSetAuth).toHaveBeenCalledWith("impersonation-token", {
      id: "u1",
      email: "alice@example.com",
      role: "USER",
    })
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("shows an error toast when impersonation fails", async () => {
    mockedGet.mockResolvedValue(
      buildPage([buildUser({ id: "u1", email: "alice@example.com", status: "ACTIVE" })]),
    )
    mockedPost.mockRejectedValue(new Error("boom"))
    const user = userEvent.setup()

    render(<UserTable />)
    await screen.findByText("alice@example.com")

    await user.click(screen.getByRole("button", { name: /impersonate/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to impersonate user")
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
