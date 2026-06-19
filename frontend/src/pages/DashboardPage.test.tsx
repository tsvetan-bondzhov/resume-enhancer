import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
import type { ResumeDto } from "@/types/api"
import { useAuthStore } from "@/stores/useAuthStore"
import DashboardPage from "./DashboardPage"

// Mock apiClient
vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock ExportFormatDialog to avoid Radix/base-ui portal side-effects in tests
// The real dialog logic is tested in ExportFormatDialog.test.tsx
let lastExportFormatDialogProps: {
  open: boolean
  resumeName: string
  isExporting: boolean
  onExport: (format: "pdf" | "docx") => void
  onClose: () => void
} | null = null

vi.mock("@/components/resume/ExportFormatDialog", () => ({
  default: (props: typeof lastExportFormatDialogProps) => {
    lastExportFormatDialogProps = props
    if (!props?.open) return null
    // Use open attribute so buttons inside are accessible to getByRole
    return (
      <dialog open aria-label="Export dialog">
        <button onClick={() => props?.onExport("pdf")} aria-label="Export as PDF">PDF</button>
        <button onClick={() => props?.onExport("docx")} aria-label="Export as DOCX">DOCX</button>
        <button onClick={() => props?.onClose()} aria-label="Cancel export">Cancel</button>
      </dialog>
    )
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
    lastExportFormatDialogProps = null
    // Reset auth store token
    useAuthStore.setState({ token: null, user: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it("empty state Go to Profile navigates to /profile", async () => {
    mockGet.mockResolvedValue([])
    renderDashboard()
    await waitFor(() =>
      screen.getByRole("button", { name: /go to profile/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /go to profile/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/profile")
  })

  it("handleExportClick opens ExportFormatDialog", async () => {
    mockGet.mockResolvedValue([buildResume({ name: "My Resume" })])
    renderDashboard()
    await waitFor(() => screen.getByRole("button", { name: /export resume/i }))
    // Click the export button on the resume card
    fireEvent.click(screen.getByRole("button", { name: /export resume/i }))
    // The mocked dialog renders an element with aria-label="Export dialog" when open=true
    // Use getByLabelText since <dialog> without the `open` attribute isn't role="dialog" in jsdom
    await waitFor(() =>
      expect(screen.getByLabelText(/export dialog/i)).toBeInTheDocument(),
    )
  })

  it("handleExport success — downloads file and closes dialog", async () => {
    const mockBlob = new Blob(["pdf"], { type: "application/pdf" })

    mockGet.mockResolvedValue([buildResume({ name: "My Resume" })])
    renderDashboard()
    await waitFor(() => screen.getByRole("button", { name: /export resume/i }))

    // Stub fetch and DOM APIs AFTER initial render
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }))
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node)
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node)

    // Open export dialog
    fireEvent.click(screen.getByRole("button", { name: /export resume/i }))
    await waitFor(() => screen.getByLabelText(/export dialog/i))

    // Click PDF button in the mocked dialog
    fireEvent.click(screen.getByRole("button", { name: /export as pdf/i }))

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Download ready", expect.any(Object)),
    )

    // Dialog should close (exportingResume becomes null → mocked dialog returns null)
    await waitFor(() =>
      expect(screen.queryByLabelText(/export dialog/i)).not.toBeInTheDocument(),
    )

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it("handleExport failure — shows error toast from response detail", async () => {
    mockGet.mockResolvedValue([buildResume({ name: "My Resume" })])
    renderDashboard()
    await waitFor(() => screen.getByRole("button", { name: /export resume/i }))

    // Open export dialog first so lastExportFormatDialogProps is populated
    fireEvent.click(screen.getByRole("button", { name: /export resume/i }))
    await waitFor(() => expect(lastExportFormatDialogProps?.open).toBe(true))

    // Stub fetch AFTER dialog is open
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Unsupported format" }),
    }))

    // Trigger export via the captured dialog props (avoids button-inside-dialog accessibility quirks)
    await act(async () => {
      lastExportFormatDialogProps?.onExport("pdf")
    })

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Unsupported format", expect.any(Object)),
    )
  })

  it("handleDelete API failure restores resume", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mockGet.mockResolvedValue([buildResume()])
      mockDelete.mockRejectedValue(new Error("server error"))
      renderDashboard()

      // Flush the initial async fetch (microtasks still run with fake timers)
      await act(async () => { await Promise.resolve() })

      // Wait for cards to appear
      await waitFor(() => expect(screen.getAllByText("Test Resume").length).toBeGreaterThan(0))

      // Click delete — optimistic removal
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /delete resume/i }))
      })
      expect(screen.queryByText("Test Resume")).not.toBeInTheDocument()

      // Advance fake timers past the 5s delete timeout and flush async operations
      await act(async () => {
        vi.advanceTimersByTime(5100)
        // Flush the rejected promise microtasks
        await Promise.resolve()
        await Promise.resolve()
      })

      // Resume should be restored after the delete API call failed
      await waitFor(() => expect(screen.getAllByText("Test Resume").length).toBeGreaterThan(0))
      expect(mockToast.error).toHaveBeenCalledWith("Delete failed — resume restored")
    } finally {
      vi.useRealTimers()
    }
  }, 10000)
})
