import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import SignupPage from "./SignupPage"

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

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (selector?: (s: { setAuth: typeof mockSetAuth }) => unknown) => {
    const state = { setAuth: mockSetAuth }
    return selector ? selector(state) : state
  },
}))

import { apiClient, ApiError } from "@/lib/apiClient"
import { toast } from "sonner"

const mockPost = vi.mocked(apiClient.post)
const mockToastError = vi.mocked(toast.error)

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  )
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders create account heading", () => {
    renderSignupPage()
    expect(screen.getByRole("heading", { name: /create an account/i })).toBeInTheDocument()
  })

  it("renders email and password fields", () => {
    renderSignupPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it("renders Create Account submit button", () => {
    renderSignupPage()
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument()
  })

  it("calls API with email and password on submit and navigates on success", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ token: "tok123", user: { id: "u1", email: "a@b.com", role: "USER" } })

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/signup", { email: "a@b.com", password: "password123" })
      expect(mockSetAuth).toHaveBeenCalledWith("tok123", expect.objectContaining({ id: "u1" }))
      expect(mockNavigate).toHaveBeenCalledWith("/")
    })
  })

  it("calls setAuth with null user when response has no user field", async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValueOnce({ token: "tok456" })

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "b@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith("tok456", null)
    })
  })

  it("shows generic error toast when non-ApiError is thrown", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new Error("Network error"))

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Registration failed. Please try again.")
    })
  })

  it("shows 'account already exists' toast on 409", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new ApiError(409, "Conflict"))

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "exists@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("An account with this email already exists")
    })
  })

  it("shows field-level email error on 400 with email validation error", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(
      new ApiError(400, "Validation failed", { email: ["Email is required"] }),
    )

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "bad")
    await user.type(screen.getByLabelText(/password/i), "pass")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email is required")
    })
  })

  it("shows detail toast on ApiError that is not 409 and not 400 validation", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new ApiError(500, "Internal server error"))

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Internal server error")
    })
  })

  it("shows fallback toast when ApiError detail is empty", async () => {
    const user = userEvent.setup()
    mockPost.mockRejectedValueOnce(new ApiError(500, ""))

    renderSignupPage()

    await user.type(screen.getByLabelText(/email/i), "a@b.com")
    await user.type(screen.getByLabelText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Registration failed. Please try again.")
    })
  })
})
