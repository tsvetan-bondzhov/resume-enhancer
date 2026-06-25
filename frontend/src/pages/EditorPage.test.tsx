import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
import type { ResumeDto } from "@/types/api"
import { useResumeStore } from "@/stores/useResumeStore"
import { useAuthStore } from "@/stores/useAuthStore"
import EditorPage from "./EditorPage"

vi.mock("@/components/resume/ChatPanel", () => ({
  default: ({ resumeId }: { resumeId: string | undefined }) => (
    <div data-testid="chat-panel" data-resume-id={resumeId ?? ""} />
  ),
}))

vi.mock("@/components/resume/AIActionBar", () => ({
  default: ({ resumeId }: { resumeId: string | undefined }) => (
    <div data-testid="ai-action-bar" data-resume-id={resumeId ?? ""} />
  ),
}))

// Mock the client-side visual PDF util so we can assert the visual path without
// running html-to-image / jsPDF.
const { mockExportVisualPdf } = vi.hoisted(() => ({
  mockExportVisualPdf: vi.fn((..._args: unknown[]) => Promise.resolve()),
}))
vi.mock("@/lib/exportVisualPdf", () => ({
  exportVisualPdf: mockExportVisualPdf,
}))

// Mock ExportablePreview to synchronously hand a fake container to onReady, so the
// visual-PDF flow completes deterministically in tests.
vi.mock("@/components/resume/ExportablePreview", () => ({
  default: ({ onReady }: { onReady: (el: HTMLElement) => void }) => {
    const el = document.createElement("div")
    queueMicrotask(() => onReady(el))
    return <div data-testid="exportable-preview" />
  },
}))

// Mock TemplateGallery to expose its onApply callback as a simple button, so we can
// drive EditorPage.handleApplyTemplate (which performs the real PUT) without needing
// a fully-fetched template list with a templateDefinition.
vi.mock("@/components/resume/TemplateGallery", () => ({
  default: ({ onApply }: { onApply: (templateId: string) => void }) => (
    <button type="button" aria-label="apply test template" onClick={() => onApply("tmpl-applied")}>
      apply
    </button>
  ),
}))

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
    // Restore default resolved implementation for the visual PDF util after clearAllMocks
    mockExportVisualPdf.mockResolvedValue(undefined)
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
    // Reset auth store
    useAuthStore.setState({ token: null, user: null })
  })

  afterEach(() => {
    useResumeStore.getState().setCurrentResume(null)
    useResumeStore.getState().setLastSavedDocument(null)
    vi.unstubAllGlobals()
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

  async function setupSidebarDeleteScenario() {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))
    const deleteBtn = screen.getByRole("button", { name: /delete sidebar resume/i })
    fireEvent.click(deleteBtn)
  }

  it("handleDeleteFromSidebar removes resume from sidebar immediately (lines 199-206)", async () => {
    await setupSidebarDeleteScenario()
    // Resume should be gone from sidebar immediately (optimistic removal)
    expect(screen.queryByText("Sidebar Resume")).not.toBeInTheDocument()
    // toast should be called with "Deleted. Undo?"
    expect(vi.mocked(toast)).toHaveBeenCalledWith("Deleted. Undo?", expect.any(Object))
  })

  it("handleDeleteFromSidebar undo restores resume (lines 212-217)", async () => {
    await setupSidebarDeleteScenario()
    expect(screen.queryByText("Sidebar Resume")).not.toBeInTheDocument()
    // The toast was called with "Deleted. Undo?" — call the undo action
    const toastCall = vi.mocked(toast).mock.calls.find((call) => call[0] === "Deleted. Undo?")
    expect(toastCall).toBeDefined()
    const options = toastCall?.[1] as unknown as { action: { onClick: () => void } }
    act(() => { options.action.onClick() })
    // Resume should be restored
    expect(screen.getByText("Sidebar Resume")).toBeInTheDocument()
  })

  it("renders ChatPanel with resumeId from route params", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByTestId("chat-panel")).toBeInTheDocument()
    )
    expect(screen.getByTestId("chat-panel")).toHaveAttribute("data-resume-id", "test-resume-id")
  })

  it("renders skip link to resume canvas as first focusable element (AC4)", () => {
    render(<EditorPage />)
    const skipLink = screen.getByRole("link", { name: /skip to resume canvas/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute("href", "#resume-canvas")
    // Should have sr-only class when not focused
    expect(skipLink.className).toContain("sr-only")
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

  async function runExportSuccessTest(format: string, mimeType: string) {
    const mockBlob = new Blob([format], { type: mimeType })

    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("textbox", { name: /resume name/i }))

    // Stub fetch and DOM APIs AFTER initial render so they don't interfere with rendering
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }))
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node)
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node)

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`export resume as ${format}`, "i") }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/resumes/test-resume-id/export?format=${format}&mode=visual`,
        expect.any(Object),
      ),
    )
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Download ready", expect.any(Object)),
    )

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  }

  it("exportPdf (toolbar, visual) — uses client path, no export fetch, calls visual util", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("textbox", { name: /resume name/i }))

    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    fireEvent.click(screen.getByRole("button", { name: /export resume as pdf/i }))

    await waitFor(() => expect(mockExportVisualPdf).toHaveBeenCalled())
    // No backend export fetch on the visual-PDF client path
    expect(fetchSpy).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Download ready", expect.any(Object)),
    )
  })

  it("exportPdf (toolbar, visual) failure — shows error toast", async () => {
    mockExportVisualPdf.mockRejectedValueOnce(new Error("Capture failed"))
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("textbox", { name: /resume name/i }))

    fireEvent.click(screen.getByRole("button", { name: /export resume as pdf/i }))

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Capture failed", expect.any(Object)),
    )
  })

  it("exportDocx (toolbar, visual) success — fetches binary with mode=visual, shows toast", async () => {
    await runExportSuccessTest("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  })

  it("exportDocx failure — shows error toast", async () => {
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("textbox", { name: /resume name/i }))

    // Stub fetch AFTER initial render
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "DOCX failed" }),
    }))

    fireEvent.click(screen.getByRole("button", { name: /export resume as docx/i }))

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("DOCX failed", expect.any(Object)),
    )
  })

  it("handleDeleteFromSidebar when deleting current resume — navigates to first remaining", async () => {
    const currentResume = buildResume({ id: "test-resume-id", name: "Active Resume" })
    const otherResume = buildResume({ id: "other-resume-id", name: "Other Resume" })
    useResumeStore.setState({ resumes: [currentResume, otherResume] })
    mockGetWithResume(currentResume)
    render(<EditorPage />)

    // Wait for sidebar to render — the other resume appears in the sidebar list
    await waitFor(() => screen.getByText("Other Resume"))

    // Delete the currently active resume (Active Resume) from sidebar
    const deleteBtn = screen.getByRole("button", { name: /delete active resume/i })
    fireEvent.click(deleteBtn)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/resumes/other-resume-id"),
    )
  })

  it("handleDeleteFromSidebar when deleting current resume and no others remain — navigates to /", async () => {
    const currentResume = buildResume({ id: "test-resume-id", name: "Only Resume" })
    useResumeStore.setState({ resumes: [currentResume] })
    mockGetWithResume(currentResume)
    render(<EditorPage />)

    // Wait for the resume name to appear in the toolbar
    await waitFor(() => screen.getByRole("textbox", { name: /resume name/i }))

    // Delete the currently active resume from sidebar — aria-label is "Delete Only Resume"
    const deleteBtn = screen.getByRole("button", { name: /delete only resume/i })
    fireEvent.click(deleteBtn)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/"),
    )
  })

  // ─── handleApplyTemplate API path (lines 187-196) ────────────────────────

  it("handleApplyTemplate success — optimistic update + PUT + success toast", async () => {
    const resume = buildResume({ id: "test-resume-id", templateId: null, name: "My Resume" })
    mockGetWithResume(resume)
    vi.mocked(apiClient.put).mockResolvedValueOnce(resume)
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("heading", { name: /edit section title/i }))

    fireEvent.click(screen.getByRole("button", { name: /apply test template/i }))

    // Optimistic update sets the new templateId immediately
    expect(useResumeStore.getState().currentResume?.templateId).toBe("tmpl-applied")
    await waitFor(() =>
      expect(vi.mocked(apiClient.put)).toHaveBeenCalledWith(
        "/api/v1/resumes/test-resume-id",
        expect.objectContaining({ templateId: "tmpl-applied", name: "My Resume" }),
      ),
    )
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Template applied"),
    )
  })

  it("handleApplyTemplate failure — reverts templateId and shows error toast (lines 195-196)", async () => {
    const resume = buildResume({ id: "test-resume-id", templateId: "original-tmpl", name: "My Resume" })
    mockGetWithResume(resume)
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error("server error"))
    render(<EditorPage />)
    await waitFor(() => screen.getByRole("heading", { name: /edit section title/i }))

    fireEvent.click(screen.getByRole("button", { name: /apply test template/i }))

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to apply template — please try again"),
    )
    // Reverted back to the original templateId
    expect(useResumeStore.getState().currentResume?.templateId).toBe("original-tmpl")
  })

  // ─── handleSidebarExport success + failure (lines 333-359) ───────────────

  it("handleSidebarExport ATS PDF — fetches binary with mode=ats and shows download toast", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))

    // Open the export-format dialog for the sidebar resume
    fireEvent.click(screen.getByRole("button", { name: /export sidebar resume/i }))
    await waitFor(() => screen.getByRole("dialog"))

    // Stub fetch + DOM download APIs
    const mockBlob = new Blob(["pdf"], { type: "application/pdf" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }))
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node)
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node)

    // Choose ATS so PDF goes through the backend fetch path
    fireEvent.click(screen.getByRole("radio", { name: /ats-friendly/i }))
    fireEvent.click(screen.getByRole("button", { name: /export as pdf/i }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/resumes/sidebar-resume/export?format=pdf&mode=ats",
        expect.any(Object),
      ),
    )
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Download ready", expect.any(Object)),
    )

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it("handleSidebarExport visual PDF — uses client path (no export fetch) via ExportablePreview", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))

    fireEvent.click(screen.getByRole("button", { name: /export sidebar resume/i }))
    await waitFor(() => screen.getByRole("dialog"))

    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    // Default mode is visual — clicking PDF takes the client path
    fireEvent.click(screen.getByRole("button", { name: /export as pdf/i }))

    await waitFor(() => expect(mockExportVisualPdf).toHaveBeenCalled())
    expect(fetchSpy).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Download ready", expect.any(Object)),
    )
  })

  it("handleSidebarExport failure — shows error toast (lines 356-357)", async () => {
    const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
    useResumeStore.setState({ resumes: [sidebarResume] })
    mockGetWithResume(buildResume())
    render(<EditorPage />)
    await waitFor(() => screen.getByText("Sidebar Resume"))

    fireEvent.click(screen.getByRole("button", { name: /export sidebar resume/i }))
    await waitFor(() => screen.getByRole("dialog"))

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Sidebar export failed" }),
    }))

    fireEvent.click(screen.getByRole("button", { name: /export as docx/i }))

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Sidebar export failed", expect.any(Object)),
    )
  })

  it("executeDeleteResume failure — restores resume in sidebar when API fails", async () => {
    vi.useFakeTimers()
    try {
      const sidebarResume = buildResume({ id: "sidebar-resume", name: "Sidebar Resume" })
      useResumeStore.setState({ resumes: [sidebarResume] })
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("server error"))
      mockGetWithResume(buildResume())
      render(<EditorPage />)

      // Flush async fetch (microtasks run even with fake timers)
      await act(async () => {})

      // Wait for sidebar to render
      expect(screen.getByText("Sidebar Resume")).toBeInTheDocument()

      // Click delete — optimistic removal
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /delete sidebar resume/i }))
      })
      expect(screen.queryByText("Sidebar Resume")).not.toBeInTheDocument()

      // Fire the 5s timeout — the delete API call will fail, restoring the resume
      await act(async () => {
        vi.runAllTimers()
      })

      // Resume should be restored in the sidebar
      expect(screen.getByText("Sidebar Resume")).toBeInTheDocument()
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Delete failed — resume restored")
    } finally {
      vi.useRealTimers()
    }
  })
})
