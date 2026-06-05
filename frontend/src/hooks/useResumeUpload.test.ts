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
      workExperienceLines: ["Software Engineer at Acme, 2020-2023"],
      educationLines: ["BSc Computer Science, MIT"],
      skillLines: ["TypeScript", "React"],
    })

    const { result } = renderHook(() => useResumeUpload())

    await simulateFileSelect(result, makeFile("resume.pdf", "application/pdf"))

    const state = useProfileStore.getState()
    expect(state.hasStarted).toBe(true)
    expect(state.profile).not.toBeNull()
    expect(state.profile?.workExperiences).toHaveLength(1)
    expect(state.profile?.workExperiences[0].jobTitle).toBe("Software Engineer at Acme, 2020-2023")
    expect(state.profile?.workExperiences[0].company).toBe("")
    expect(state.profile?.education).toHaveLength(1)
    expect(state.profile?.education[0].institution).toBe("BSc Computer Science, MIT")
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

  it("Test 3: Successful upload but all line lists empty → toast.warning called; hasStarted becomes true; profile not seeded", async () => {
    const { apiClient } = await import("@/lib/apiClient")
    const { toast } = await import("sonner")

    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      rawText: "some raw text",
      workExperienceLines: [],
      educationLines: [],
      skillLines: [],
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
})
