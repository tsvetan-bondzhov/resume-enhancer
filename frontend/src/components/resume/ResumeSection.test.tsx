import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { useResumeStore } from "@/stores/useResumeStore"
import { useAutosave } from "@/hooks/useAutosave"
import { apiClient } from "@/lib/apiClient"
import ResumeSection from "./ResumeSection"
import type { ResumeSectionDto, ResumeDto } from "@/types/api"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

function buildSection(overrides?: Partial<ResumeSectionDto>): ResumeSectionDto {
  return {
    sectionType: "WORK_EXPERIENCE",
    title: "Work Experience",
    visible: true,
    items: [
      {
        id: "item-1",
        fields: { jobTitle: "Engineer", company: "Acme Corp" },
      },
    ],
    ...overrides,
  }
}

function buildResumeWithSection(
  section: ResumeSectionDto = buildSection()
): ResumeDto {
  return {
    id: "resume-1",
    name: "Test Resume",
    templateId: null,
    content: { sections: [section] },
    isTailored: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe("ResumeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    useResumeStore.setState({ currentResume: null, lastSavedDocument: null })
  })

  it("editing a field dispatches onFieldChange callback", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    const field = screen.getByText("Engineer")
    fireEvent.blur(field, { target: { textContent: "Senior Engineer" } })

    expect(onFieldChange).toHaveBeenCalledWith(
      "item-1",
      "jobTitle",
      "Senior Engineer"
    )
  })

  it("editing the section title dispatches onTitleChange callback", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    const title = screen.getByRole("heading", { name: /work experience/i })
    fireEvent.blur(title, { target: { textContent: "Professional Experience" } })

    expect(onTitleChange).toHaveBeenCalledWith("Professional Experience")
  })

  it("renders section title and item fields", () => {
    const section = buildSection()
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    expect(
      screen.getByRole("heading", { name: /edit section title/i })
    ).toBeInTheDocument()
    expect(screen.getByText("Engineer")).toBeInTheDocument()
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("does not render items with empty field values", () => {
    const section = buildSection({
      items: [
        {
          id: "item-empty",
          fields: { jobTitle: "", company: "Only Company" },
        },
      ],
    })
    const onFieldChange = vi.fn()
    const onTitleChange = vi.fn()

    render(
      <ResumeSection
        section={section}
        onTitleChange={onTitleChange}
        onFieldChange={onFieldChange}
      />
    )

    expect(screen.getByText("Only Company")).toBeInTheDocument()
    // Empty jobTitle should not be rendered
    expect(screen.queryByText("jobTitle")).not.toBeInTheDocument()
  })

  // ─── AC7: store + autosave lifecycle integration ──────────────────────────

  it("onFieldChange wired to updateItemField mutates useResumeStore state", () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    render(
      <ResumeSection
        section={section}
        onTitleChange={(title) =>
          useResumeStore.getState().updateSectionTitle(section.sectionType, title)
        }
        onFieldChange={(itemId, field, value) =>
          useResumeStore.getState().updateItemField(section.sectionType, itemId, field, value)
        }
      />
    )

    const field = screen.getByText("Engineer")
    fireEvent.blur(field, { target: { textContent: "Senior Engineer" } })

    const updatedFields =
      useResumeStore.getState().currentResume?.content.sections[0].items[0]
        .fields
    expect(updatedFields?.jobTitle).toBe("Senior Engineer")
  })

  it("onTitleChange wired to updateSectionTitle mutates useResumeStore state", () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    render(
      <ResumeSection
        section={section}
        onTitleChange={(title) =>
          useResumeStore.getState().updateSectionTitle(section.sectionType, title)
        }
        onFieldChange={(itemId, field, value) =>
          useResumeStore.getState().updateItemField(section.sectionType, itemId, field, value)
        }
      />
    )

    const heading = screen.getByRole("heading", { name: /work experience/i })
    fireEvent.blur(heading, { target: { textContent: "Professional Experience" } })

    const updatedTitle =
      useResumeStore.getState().currentResume?.content.sections[0].title
    expect(updatedTitle).toBe("Professional Experience")
  })

  it("debounced PUT fires 500ms after a field edit via useAutosave", async () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)
    const updatedResume: ResumeDto = {
      ...resume,
      content: {
        sections: [
          {
            ...section,
            items: [{ id: "item-1", fields: { jobTitle: "Senior Engineer", company: "Acme Corp" } }],
          },
        ],
      },
    }

    vi.mocked(apiClient.put).mockResolvedValue(updatedResume)

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave(resume.id))

    // Simulate a field change via store action (makes content differ from lastSaved)
    act(() => {
      useResumeStore
        .getState()
        .updateItemField(section.sectionType, "item-1", "jobTitle", "Senior Engineer")
    })

    // Before 500ms elapses, PUT should not have been called
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(apiClient.put).not.toHaveBeenCalled()

    // Advance past the 500ms debounce to trigger the PUT
    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    // Let the resolved promise settle
    await act(async () => {
      await Promise.resolve()
    })

    expect(apiClient.put).toHaveBeenCalledWith(
      `/api/v1/resumes/${resume.id}`,
      expect.objectContaining({ name: resume.name })
    )
  })

  it("on PUT failure, useAutosave reverts store to lastSavedDocument", async () => {
    const section = buildSection()
    const resume = buildResumeWithSection(section)

    vi.mocked(apiClient.put).mockRejectedValue(new Error("Network error"))

    useResumeStore.setState({
      currentResume: resume,
      lastSavedDocument: resume.content,
    })

    renderHook(() => useAutosave(resume.id))

    // Simulate a field change via store action (makes content differ from lastSaved)
    act(() => {
      useResumeStore
        .getState()
        .updateItemField(section.sectionType, "item-1", "jobTitle", "Changed Title")
    })

    // Advance past the 500ms debounce to trigger the PUT
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Let the rejected promise settle
    await act(async () => {
      await Promise.resolve()
    })

    // Store should have reverted to the original field value
    const revertedField =
      useResumeStore.getState().currentResume?.content.sections[0].items[0]
        .fields.jobTitle
    expect(revertedField).toBe("Engineer")
  })
})
