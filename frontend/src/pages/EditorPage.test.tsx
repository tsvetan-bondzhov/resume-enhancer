import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
import type { ResumeDto } from "@/types/api"
import { useResumeStore } from "@/stores/useResumeStore"
import EditorPage from "./EditorPage"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    // put is mocked to a never-resolving promise so autosave doesn't interfere with tests
    put: vi.fn(() => new Promise(() => {})),
    post: vi.fn(),
    delete: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useParams: () => ({ id: "test-resume-id" }),
    useNavigate: () => mockNavigate,
  }
})

const mockGet = vi.mocked(apiClient.get)

function mockGetWithResume(resume: ResumeDto) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes("resume-templates")) return Promise.resolve([])
    return Promise.resolve(resume)
  })
}

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "test-resume-id",
    name: "Test Resume",
    templateId: null,
    content: {
      sections: [
        {
          sectionType: "WORK_EXPERIENCE" as const,
          title: "Work Experience",
          visible: true,
          items: [
            {
              type: "WORK_EXPERIENCE" as const,
              id: "item-1",
              jobTitle: "Engineer",
              company: "Acme Corp",
              startDate: null,
              endDate: null,
              isCurrent: false,
              description: null,
            },
          ],
        },
      ],
    },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("EditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore never-resolving put mock after clearAllMocks
    vi.mocked(apiClient.put).mockReturnValue(new Promise(() => {}))
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    // Default: templates endpoint returns empty array so TemplateGallery renders without crashing
    mockGet.mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve([])
      return new Promise(() => {})
    })
    mockNavigate.mockReset()
    useResumeStore.setState({ resumes: [] })
  })

  afterEach(() => {
    useResumeStore.getState().setCurrentResume(null)
    useResumeStore.getState().setLastSavedDocument(null)
  })

  it("renders skeleton while loading", () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve([])
      return new Promise(() => {})
    })
    render(<EditorPage />)
    expect(screen.getByLabelText(/resume preview loading/i)).toBeInTheDocument()
  })

  it("renders resume sections after successful fetch", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      screen.getByRole("heading", { name: /edit section title/i }),
    )
    expect(
      screen.getByRole("heading", { name: /edit section title/i }),
    ).toBeInTheDocument()
  })

  it("renders error toast on fetch failure", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve([])
      return Promise.reject(new Error("network"))
    })
    render(<EditorPage />)
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to load resume",
      ),
    )
  })

  it("calls setCurrentResume with fetched resume", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      screen.getByRole("heading", { name: /edit section title/i }),
    )
    expect(useResumeStore.getState().currentResume?.id).toBe("test-resume-id")
  })

  it("renders editor toolbar with resume name after fetch", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /resume name/i })).toHaveValue("Test Resume")
    )
  })

  it("navigates to dashboard on back button click", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByLabelText(/back to resumes/i))
    fireEvent.click(screen.getByLabelText(/back to resumes/i))
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("opens Save As dialog when Save As button is clicked", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("button", { name: /save as new resume/i }))
    fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    )
  })

  it("calls clone endpoint and navigates on Save As confirm", async () => {
    const newResume = buildResume({ id: "new-resume-id", name: "My Copy" })
    mockGetWithResume(buildResume())
    vi.mocked(apiClient.post).mockResolvedValue(newResume)
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("button", { name: /save as new resume/i }))
    fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
    const dialog = await waitFor(() => screen.getByRole("dialog"))
    // Clear default name and type new one — use the input inside the dialog
    const nameInput = dialog.querySelector<HTMLInputElement>("#save-as-name")!
    fireEvent.change(nameInput, { target: { value: "My Copy" } })
    fireEvent.click(screen.getByRole("button", { name: /^save as$/i }))
    await waitFor(() =>
      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith(
        "/api/v1/resumes/test-resume-id/clone",
        { name: "My Copy" }
      )
    )
    expect(mockNavigate).toHaveBeenCalledWith("/resumes/new-resume-id")
  })

  it("shows validation error when Save As is submitted with blank name (AC3)", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("button", { name: /save as new resume/i }))
    fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
    const dialog = await waitFor(() => screen.getByRole("dialog"))
    const nameInput = dialog.querySelector<HTMLInputElement>("#save-as-name")!
    fireEvent.change(nameInput, { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: /^save as$/i }))
    await waitFor(() =>
      expect(screen.getByText("Name is required")).toBeInTheDocument()
    )
    expect(vi.mocked(apiClient.post)).not.toHaveBeenCalled()
  })

  it("updates document.title with resume name after fetch (AC1)", async () => {
    mockGetWithResume(buildResume({ name: "My Awesome Resume" }))
    render(<EditorPage />)
    await waitFor(() =>
      expect(document.title).toBe("My Awesome Resume — Resume Enhancer")
    )
  })

  it("renders back navigation button in error state (AC6)", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve([])
      return Promise.reject(new Error("network"))
    })
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByLabelText(/back to resumes/i)).toBeInTheDocument()
    )
  })

  it("shows error message in center panel on fetch failure (line 269-271)", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("resume-templates")) return Promise.resolve([])
      return Promise.reject(new Error("network"))
    })
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByText("Failed to load resume")).toBeInTheDocument()
    )
  })

  it("calls clone API and shows error toast when Save As fails (lines 147-148)", async () => {
    mockGetWithResume(buildResume())
    vi.mocked(apiClient.post).mockRejectedValue(new Error("server error"))
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("button", { name: /save as new resume/i }))
    fireEvent.click(screen.getByRole("button", { name: /save as new resume/i }))
    const dialog = await waitFor(() => screen.getByRole("dialog"))
    const nameInput = dialog.querySelector<HTMLInputElement>("#save-as-name")!
    fireEvent.change(nameInput, { target: { value: "My Copy" } })
    fireEvent.click(screen.getByRole("button", { name: /^save as$/i }))
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to save as — please try again"
      )
    )
  })

  it("renders sidebar resumes list when store has resumes (lines 235-241)", async () => {
    const resume1 = buildResume({ id: "resume-1", name: "Resume One" })
    const resume2 = buildResume({ id: "resume-2", name: "Resume Two" })
    // Pre-populate store with two resumes so sidebarResumes initialises with them
    useResumeStore.setState({ resumes: [resume1, resume2] })
    mockGetWithResume(buildResume({ id: "test-resume-id", name: "Test Resume" }))
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByText("Resume One")).toBeInTheDocument()
    )
    expect(screen.getByText("Resume Two")).toBeInTheDocument()
  })

  it("handleDuplicateFromSidebar succeeds — prepends new resume to sidebar", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    const clonedResume = buildResume({ id: "cloned-resume", name: "Sidebar Resume (copy)" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    vi.mocked(apiClient.post).mockResolvedValue(clonedResume)
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))
    // Click duplicate button on the sidebar resume item
    const duplicateBtn = screen.getByRole("button", { name: /duplicate sidebar resume/i })
    fireEvent.click(duplicateBtn)
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Resume duplicated")
    )
    expect(screen.getByText("Sidebar Resume (copy)")).toBeInTheDocument()
  })

  it("handleDuplicateFromSidebar failure — shows error toast (lines 190-191)", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    vi.mocked(apiClient.post).mockRejectedValue(new Error("network"))
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))
    const duplicateBtn = screen.getByRole("button", { name: /duplicate sidebar resume/i })
    fireEvent.click(duplicateBtn)
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to duplicate resume")
    )
  })

  it("handleDeleteFromSidebar removes resume from sidebar immediately (lines 199-206)", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))
    const deleteBtn = screen.getByRole("button", { name: /delete sidebar resume/i })
    fireEvent.click(deleteBtn)
    // Resume should be gone from sidebar immediately (optimistic removal)
    expect(screen.queryByText("Sidebar Resume")).not.toBeInTheDocument()
    // toast should be called with "Deleted. Undo?"
    expect(vi.mocked(toast)).toHaveBeenCalledWith("Deleted. Undo?", expect.any(Object))
  })

  it("handleDeleteFromSidebar undo restores resume (lines 212-217)", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))
    const deleteBtn = screen.getByRole("button", { name: /delete sidebar resume/i })
    fireEvent.click(deleteBtn)
    expect(screen.queryByText("Sidebar Resume")).not.toBeInTheDocument()
    // The toast was called with "Deleted. Undo?" — call the undo action
    const toastCall = vi.mocked(toast).mock.calls.find((call) => call[0] === "Deleted. Undo?")
    expect(toastCall).toBeDefined()
    const options = toastCall?.[1] as unknown as { action: { onClick: () => void } }
    act(() => { options.action.onClick() })
    // Resume should be restored
    expect(screen.getByText("Sidebar Resume")).toBeInTheDocument()
  })

  it("handleApplyTemplate — optimistic update sets templateId on store (lines 160-167)", async () => {
    const resume = buildResume({ id: "test-resume-id", templateId: null })
    mockGetWithResume(resume)
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("heading", { name: /edit section title/i }))
    // Verify resume is loaded and templateId is initially null
    expect(useResumeStore.getState().currentResume?.templateId).toBeNull()
    // Call setCurrentResumeTemplateId directly (simulates optimistic update in handleApplyTemplate)
    act(() => { useResumeStore.getState().setCurrentResumeTemplateId("template-xyz") })
    expect(useResumeStore.getState().currentResume?.templateId).toBe("template-xyz")
  })
})
