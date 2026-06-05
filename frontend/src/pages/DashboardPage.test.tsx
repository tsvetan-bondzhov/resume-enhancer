import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
import type { ResumeDto } from "@/types/api"
import DashboardPage from "./DashboardPage"

// Mock apiClient
vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock sonner — toast is both a callable function AND has .success / .error methods
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

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockDelete = vi.mocked(apiClient.delete)
const mockToast = vi.mocked(toast)

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "test-id",
    name: "Test Resume",
    templateId: null,
    content: { sections: [] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDelete.mockResolvedValue(undefined)
  })

  it("renders 3 skeleton cards while loading", () => {
    // Never-resolving promise keeps component in loading state
    mockGet.mockReturnValue(new Promise(() => {}))
    renderDashboard()
    const skeletons = screen.getAllByLabelText("Loading resume card")
    expect(skeletons).toHaveLength(3)
  })

  it("renders empty state when no resumes", async () => {
    mockGet.mockResolvedValue([])
    renderDashboard()
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /your resumes live here/i }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /go to profile/i }),
    ).toBeInTheDocument()
  })

  it("renders resume cards when resumes exist", async () => {
    mockGet.mockResolvedValue([buildResume({ name: "My Resume" })])
    renderDashboard()
    await waitFor(() => {
      expect(screen.getAllByText("My Resume").length).toBeGreaterThan(0)
    })
  })

  it("clicking Open navigates to editor", async () => {
    mockGet.mockResolvedValue([buildResume()])
    renderDashboard()
    await waitFor(() =>
      screen.getByRole("button", { name: /open resume/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /open resume/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/resumes/test-id")
  })

  it("delete soft-removes card and shows undo toast", async () => {
    vi.useFakeTimers()
    try {
      mockGet.mockResolvedValue([buildResume()])
      renderDashboard()

      // Flush the initial async fetch (promise microtasks still run with fake timers)
      await act(async () => {})

      // Card should be visible
      expect(screen.getAllByText("Test Resume").length).toBeGreaterThan(0)

      // Click delete button
      fireEvent.click(screen.getByRole("button", { name: /delete resume/i }))

      // Card should be removed from DOM immediately (optimistic)
      expect(screen.queryByText("Test Resume")).not.toBeInTheDocument()

      // Toast should be called with undo action
      expect(mockToast).toHaveBeenCalledWith(
        "Deleted. Undo?",
        expect.objectContaining({ duration: 5000 }),
      )

      // Fire the 5s timeout to trigger the actual API delete
      await act(async () => {
        vi.runAllTimers()
      })

      // DELETE API should have been called
      expect(mockDelete).toHaveBeenCalledWith("/api/v1/resumes/test-id")
    } finally {
      vi.useRealTimers()
    }
  })

  it("undo delete restores card before API call", async () => {
    vi.useFakeTimers()
    try {
      mockGet.mockResolvedValue([buildResume()])
      renderDashboard()

      // Flush the initial async fetch
      await act(async () => {})

      // Click delete button
      fireEvent.click(screen.getByRole("button", { name: /delete resume/i }))

      // Extract the undo onClick from the toast call arguments
      const toastCallArgs = mockToast.mock.calls[0] as [
        string,
        { action: { label: string; onClick: () => void }; duration: number },
      ]
      const undoFn = toastCallArgs[1].action.onClick

      // Invoke the undo callback
      await act(async () => {
        undoFn()
      })

      // Card should be restored in the DOM
      expect(screen.getAllByText("Test Resume").length).toBeGreaterThan(0)

      // Advance timers — the timeout was cleared by undo, so no API call should happen
      await act(async () => {
        vi.runAllTimers()
      })

      // DELETE should NOT have been called
      expect(mockDelete).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("duplicate creates copy and shows success toast", async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue([buildResume({ name: "My Resume" })])
    mockPost.mockResolvedValue(
      buildResume({ id: "new-id", name: "My Resume (copy)" }),
    )
    renderDashboard()

    await waitFor(() => screen.getAllByText("My Resume"))

    await user.click(screen.getByRole("button", { name: /duplicate resume/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/resumes/test-id/clone",
        { name: "My Resume (copy)" },
      )
    })

    expect(mockToast.success).toHaveBeenCalledWith("Resume duplicated")

    await waitFor(() => {
      expect(screen.getAllByText("My Resume (copy)").length).toBeGreaterThan(0)
    })
  })
})
