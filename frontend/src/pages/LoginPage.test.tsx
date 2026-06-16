import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import LoginPage from "./LoginPage"

// Mock apiClient
vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    detail: string
    errors?: Record<string, string[]>
    constructor(status: number, detail: string, errors?: Record<string, string[]>) {
      super(detail)
      this.name = "ApiError"
      this.status = status
      this.detail = detail
      this.errors = errors
    }
  },
}))

// Mock sonner
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock useAuthStore
const mockSetAuth = vi.fn()
let mockToken: string | null = null

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (selector?: (s: { token: string | null; setAuth: typeof mockSetAuth }) => unknown) => {
    const state = { token: mockToken, setAuth: mockSetAuth }
    return selector ? selector(state) : state
  },
}))

import { apiClient, ApiError } from "@/lib/apiClient"
import { toast } from "sonner"

const mockPost = vi.mocked(apiClient.post)
const mockToastError = vi.mocked(toast.error)

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToken = null
  })

  it("renders sign in heading", () => {
    renderLoginPage()
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument()
  })

  it("renders email and password fields", () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it("renders Sign In submit button", () => {
    renderLoginPage()
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
  })

  it("redirects to / when already authenticated", () => {
    mockToken = "existing-token"
    renderLoginPage()
    // Navigate component is rendered; heading should not be present
    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument()
  })

  it("calls API with email and password on submit and navigates on success", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ token: "tok123", user: { id: "u1", email: "a@b.com", role: "USER" } })

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "secret")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/login", { email: "a@b.com", password: "secret" })
      expect(mockSetAuth).toHaveBeenCalledWith("tok123", expect.objectContaining({ id: "u1" }))
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("shows generic error toast when non-ApiError is thrown", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new Error("Network error"))

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "secret")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Sign in failed. Please try again.")
    })
  })

  it("shows 'Invalid email or password' toast on 401", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new ApiError(401, "Unauthorized"))

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "wrong")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Invalid email or password")
    })
  })

  it("shows field-level email error on 400 with email validation error", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(
      new ApiError(400, "Validation failed", { email: ["Email is required"] }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), "bad")
    await user.type(screen.getByLabelText(/password/i), "pass")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email is required")
    })
  })

  it("shows detail toast on ApiError that is not 401 and not 400 validation", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new ApiError(500, "Server error"))

    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "pass")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Server error")
    })
  })
})
