import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useProfileStore } from "@/stores/useProfileStore"
import { ApiError } from "@/lib/apiClient"
import { useResumeUpload } from "./useResumeUpload"

// Mock apiClient
vi.mock("@/lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiClient")>()
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      uploadFile: vi.fn(),
    },
  }
})

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

function resetProfileStore() {
  useProfileStore.setState({
    profile: null,
    isSaving: false,
    isLoading: false,
    error: null,
    currentStep: 0,
    hasStarted: false,
  })
}

// Helper: create a fake File object
function makeFile(name: string, type: string): File {
  return new File(["content"], name, { type })
}

// Helper: simulate a file selection on the hidden input via the hook's onChange
async function simulateFileSelect(
  result: ReturnType<typeof renderHook<ReturnType<typeof useResumeUpload>, unknown>>["result"],
  file: File,
) {
  // Render the file input to get the onChange handler
  const element = result.current.renderFileInput()
  // @ts-expect-error accessing JSX props for testing
  const onChange = element.props.onChange as (e: { target: { files: FileList | null; value: string } }) => void
  const mockFileList = {
    0: file,
    length: 1,
    item: (i: number) => (i === 0 ? file : null),
    [Symbol.iterator]: function* () { yield file },
  } as unknown as FileList
  await act(async () => {
    onChange({ target: { files: mockFileList, value: "" } })
  })
}

describe("useResumeUpload", () => {
  beforeEach(() => {
    resetProfileStore()
    vi.clearAllMocks()
  })

  it("Test 1: Successful upload with non-empty parse → profile store is updated and hasStarted becomes true", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      rawText: "raw",
      workExperiences: [
        {
          jobTitle: "Software Engineer",
          company: "Acme Corp",
          startDate: "2020-01-01",
          endDate: "2023-06-01",
          isCurrent: false,
          description: "Built services",
        },
      ],
      education: [
        {
          institution: "MIT",
          degree: "BSc",
          fieldOfStudy: "Computer Science",
          startDate: "2016-09-01",
          endDate: "2020-05-01",
        },
      ],
      skills: [
        { name: "TypeScript", category: null, proficiency: null },
        { name: "React", category: null, proficiency: null },
      ],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
      summary: null,
    })

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("resume.pdf", "application/pdf"))

    const state = useProfileStore.getState()
    expect(state.hasStarted).toBe(true)
    expect(state.profile).not.toBeNull()
    expect(state.profile?.workExperiences).toHaveLength(1)
    expect(state.profile?.workExperiences[0].jobTitle).toBe("Software Engineer")
    expect(state.profile?.workExperiences[0].company).toBe("Acme Corp")
    expect(state.profile?.education).toHaveLength(1)
    expect(state.profile?.education[0].institution).toBe("MIT")
    expect(state.profile?.skills).toHaveLength(2)
    expect(state.profile?.skills[0].name).toBe("TypeScript")
    expect(result.current.isUploading).toBe(false)
  })

  it("Test 2: Server returns 422 → toast.error called with correct message; profile store unchanged", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    const { toast } = await import("sonner")

    vi.mocked(apiClient.uploadFile).mockRejectedValueOnce(
      new ApiError(422, "File rejected"),
    )

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("bad.exe", "application/octet-stream"))

    expect(toast.error).toHaveBeenCalledWith(
      "File rejected — must be a PDF or DOCX under 10MB",
    )
    const state = useProfileStore.getState()
    expect(state.profile).toBeNull()
    expect(state.hasStarted).toBe(false)
    expect(result.current.isUploading).toBe(false)
  })

  it("Test 3: Successful upload but all typed section arrays empty → toast.warning called; hasStarted becomes true; profile not seeded", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    const { toast } = await import("sonner")

    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      rawText: "some raw text",
      workExperiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      volunteering: [],
      summary: null,
    })

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("resume.pdf", "application/pdf"))

    expect(toast.warning).toHaveBeenCalledWith(
      "We couldn't extract profile data — please enter your details manually",
    )
    const state = useProfileStore.getState()
    expect(state.hasStarted).toBe(true)
    // Profile should remain null (not seeded with empty data)
    expect(state.profile).toBeNull()
    expect(result.current.isUploading).toBe(false)
  })

  it("Test 4: Network error (non-422) → toast.error called with generic message", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    const { toast } = await import("sonner")

    vi.mocked(apiClient.uploadFile).mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("resume.pdf", "application/pdf"))

    expect(toast.error).toHaveBeenCalledWith("Upload failed — please try again")
    const state = useProfileStore.getState()
    expect(state.profile).toBeNull()
    expect(result.current.isUploading).toBe(false)
  })

  it("Test 5: LLM result with all 8 section types → all sections mapped to profile store", async () => {
    const { apiClient } = await import("@/lib/apiClient")

    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      rawText: "raw",
      workExperiences: [
        { jobTitle: "Engineer", company: "Corp", startDate: null, endDate: null, isCurrent: true, description: null },
      ],
      education: [
        { institution: "University", degree: "BSc", fieldOfStudy: "CS", startDate: null, endDate: null },
      ],
      skills: [{ name: "Java", category: null, proficiency: null }],
      certifications: [
        { name: "AWS Certified", issuer: "Amazon", issueDate: "2022-01-01", expirationDate: null },
      ],
      languages: [{ language: "English", proficiency: "Native" }],
      projects: [
        {
          name: "My Project",
          description: "A cool project",
          technologies: "React",
          link: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
        },
      ],
      volunteering: [
        {
          role: "Mentor",
          organization: "Code Club",
          description: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
        },
      ],
      summary: { text: "Experienced engineer." },
    })

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("resume.pdf", "application/pdf"))

    const state = useProfileStore.getState()
    expect(state.hasStarted).toBe(true)
    expect(state.profile?.workExperiences).toHaveLength(1)
    expect(state.profile?.education).toHaveLength(1)
    expect(state.profile?.skills).toHaveLength(1)
    expect(state.profile?.certifications).toHaveLength(1)
    expect(state.profile?.certifications[0].name).toBe("AWS Certified")
    expect(state.profile?.languages).toHaveLength(1)
    expect(state.profile?.projects).toHaveLength(1)
    expect(state.profile?.projects[0].name).toBe("My Project")
    expect(state.profile?.volunteering).toHaveLength(1)
    expect(state.profile?.summary).toBe("Experienced engineer.")
  })
})
