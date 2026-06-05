import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useParams: () => ({ id: "test-resume-id" }) }
})

const mockGet = vi.mocked(apiClient.get)

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "test-resume-id",
    name: "Test Resume",
    templateId: null,
    content: {
      sections: [
        {
          id: "section-1",
          title: "Work Experience",
          visible: true,
          items: [
            {
              id: "item-1",
              fields: { company: "Acme Corp", jobTitle: "Engineer" },
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
  })

  afterEach(() => {
    useResumeStore.getState().setCurrentResume(null)
    useResumeStore.getState().setLastSavedDocument(null)
  })

  it("renders skeleton while loading", () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<EditorPage />)
    expect(screen.getByLabelText(/resume preview loading/i)).toBeInTheDocument()
  })

  it("renders resume sections after successful fetch", async () => {
    mockGet.mockResolvedValue(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      screen.getByRole("heading", { name: /edit section title/i }),
    )
    expect(
      screen.getByRole("heading", { name: /edit section title/i }),
    ).toBeInTheDocument()
  })

  it("renders error toast on fetch failure", async () => {
    mockGet.mockRejectedValue(new Error("network"))
    render(<EditorPage />)
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to load resume",
      ),
    )
  })

  it("calls setCurrentResume with fetched resume", async () => {
    mockGet.mockResolvedValue(buildResume())
    render(<EditorPage />)
    await waitFor(() =>
      screen.getByRole("heading", { name: /edit section title/i }),
    )
    expect(useResumeStore.getState().currentResume?.id).toBe("test-resume-id")
  })
})
