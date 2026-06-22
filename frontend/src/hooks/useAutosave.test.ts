import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import { toast } from "sonner"
import { useResumeStore } from "@/stores/useResumeStore"
import { useAutosave } from "./useAutosave"
import type { ResumeDto } from "@/types/api"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

const mockPut = vi.mocked(apiClient.put)

function buildResume(overrides?: Partial<ResumeDto>): ResumeDto {
  return {
    id: "resume-1",
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
              company: null,
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

describe("useAutosave", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    useResumeStore.setState({
      currentResume: null,
      lastSavedDocument: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    useResumeStore.setState({ currentResume: null, lastSavedDocument: null })
  })

  it("returns idle status initially", () => {
    const { result } = renderHook(() => useAutosave("resume-1"))
    expect(result.current.status).toBe("idle")
  })

  it("does not fire PUT when lastSavedDocument is null (initial load guard)", async () => {
    const resume = buildResume()
    useResumeStore.setState({ currentResume: resume, lastSavedDocument: null })

    renderHook(() => useAutosave("resume-1"))

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockPut).not.toHaveBeenCalled()
  })

  it("schedules PUT request 500ms after currentResume changes", async () => {
    const resume = buildResume()
    const updatedResume: ResumeDto = {
      ...resume,
      content: {
        sections: [
          {
            sectionType: "WORK_EXPERIENCE" as const,
            title: "Professional Experience",
            visible: true,
            items: [],
          },
        ],
      },
    }

    mockPut.mockResolvedValue(updatedResume)

    // Simulate page load: set currentResume AND lastSavedDocument
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave("resume-1"))

    // Simulate an edit
    act(() => {
      useResumeStore.setState({ currentResume: updatedResume })
    })

    // Before debounce fires
    expect(mockPut).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith(
      "/api/v1/resumes/resume-1",
      expect.objectContaining({ name: "Test Resume" })
    )
  })

  it("transitions to saved status on successful PUT", async () => {
    const resume = buildResume()
    mockPut.mockResolvedValue(resume)

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    const { result } = renderHook(() => useAutosave("resume-1"))

    // Trigger a change (both name and content must differ to satisfy the dirty-check guard)
    act(() => {
      useResumeStore.setState({
        currentResume: {
          ...resume,
          name: "Changed Name",
          content: {
            sections: [
              {
                sectionType: "WORK_EXPERIENCE" as const,
                title: "Updated Title",
                visible: true,
                items: [],
              },
            ],
          },
        },
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.status).toBe("saved")
  })

  it("reverts currentResume to lastSavedDocument on PUT failure", async () => {
    const originalContent = {
      sections: [
        {
          sectionType: "WORK_EXPERIENCE" as const,
          title: "Original Title",
          visible: true,
          items: [],
        },
      ],
    }
    const modifiedContent = {
      sections: [
        {
          sectionType: "WORK_EXPERIENCE" as const,
          title: "Modified Title",
          visible: true,
          items: [],
        },
      ],
    }

    const resume = buildResume({ content: originalContent })
    const modifiedResume = buildResume({ content: modifiedContent })

    mockPut.mockRejectedValue(new Error("Network error"))

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: originalContent,
    })

    renderHook(() => useAutosave("resume-1"))

    // Simulate edit
    act(() => {
      useResumeStore.setState({ currentResume: modifiedResume })
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Wait for the promise rejection to be handled
    await act(async () => {
      await Promise.resolve()
    })

    expect(useResumeStore.getState().currentResume?.content).toEqual(
      originalContent
    )
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Save failed — changes reverted"
    )
  })

  it("saveNow fires PUT even when snapshot matches (no dirty changes)", async () => {
    const resume = buildResume()
    mockPut.mockResolvedValue(resume)

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    const { result } = renderHook(() => useAutosave("resume-1"))

    // Let the debounce fire so the snapshot is established after the initial load
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    mockPut.mockClear()

    // Manually save with no changes — snapshot matches, but PUT should still fire
    await act(async () => {
      result.current.saveNow()
      await Promise.resolve()
    })

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith(
      "/api/v1/resumes/resume-1",
      expect.objectContaining({ name: "Test Resume" })
    )
  })

  it("does not fire PUT when resumeId is undefined", async () => {
    const resume = buildResume()
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave(undefined))

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockPut).not.toHaveBeenCalled()
  })
})
