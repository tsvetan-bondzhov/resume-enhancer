import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
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
    if ((url as string).includes("resume-templates")) return Promise.resolve([])
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
    // Default: templates endpoint returns empty array so TemplateGallery renders without crashing
    mockGet.mockImplementation((url: string) => {
      if ((url as string).includes("resume-templates")) return Promise.resolve([])
      return new Promise(() => {})
    })
    mockNavigate.mockReset()
  })

  afterEach(() => {
    useResumeStore.getState().setCurrentResume(null)
    useResumeStore.getState().setLastSavedDocument(null)
  })

  it("renders skeleton while loading", () => {
    mockGet.mockImplementation((url: string) => {
      if ((url as string).includes("resume-templates")) return Promise.resolve([])
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
      if ((url as string).includes("resume-templates")) return Promise.resolve([])
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
      if ((url as string).includes("resume-templates")) return Promise.resolve([])
      return Promise.reject(new Error("network"))
    })
    render(<EditorPage />)
    await waitFor(() =>
      expect(screen.getByLabelText(/back to resumes/i)).toBeInTheDocument()
    )
  })
})
